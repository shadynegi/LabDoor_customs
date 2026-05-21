// server/src/server.ts - Production Ready REST API
import express from "express";
import type { Request, Response, NextFunction } from "express";
import https from "https";
import fs from "fs";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { emailService } from './lib/email';
import sql, { withRetry } from './lib/db';
import { csrfTokenSetter, csrfProtection, getCsrfTokenHandler } from './middleware/csrf';

// Import routes
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import contactRouter from "./routes/contact";
import adminRouter from "./routes/admin";
import activityRouter from "./routes/activity";
import reviewsRouter from "./routes/reviews";
import couponsRouter from "./routes/coupons";

dotenv.config();

// Validate required environment variables at startup
const validateEnvVars = () => {
  const required = ['DATABASE_URL'];
  const recommended = ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'JWT_SECRET', 'RESEND_API_KEY'];
  
  const missing = required.filter(v => !process.env[v]);
  const missingRecommended = recommended.filter(v => !process.env[v]);
  
  if (missing.length > 0) {
    console.error('❌ Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  
  if (missingRecommended.length > 0) {
    console.warn('⚠️  Missing recommended environment variables:', missingRecommended.join(', '));
    console.warn('   Some features (admin auth, email notifications) may not work properly.');
  }
  
  // Validate JWT_SECRET length if provided
  if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
    console.warn('⚠️  JWT_SECRET should be at least 32 characters for security');
  }
};

validateEnvVars();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// HTTPS/SSL Configuration
const getSSLConfig = () => {
  // Check if SSL certificates are configured
  const sslKeyPath = process.env.SSL_KEY_PATH;
  const sslCertPath = process.env.SSL_CERT_PATH;
  const sslCaPath = process.env.SSL_CA_PATH; // Optional: CA certificate for full chain
  
  if (!sslKeyPath || !sslCertPath) {
    return null;
  }
  
  try {
    const options: https.ServerOptions = {
      key: fs.readFileSync(path.resolve(sslKeyPath)),
      cert: fs.readFileSync(path.resolve(sslCertPath)),
    };
    
    // Add CA certificate if provided (recommended for production)
    if (sslCaPath && fs.existsSync(path.resolve(sslCaPath))) {
      options.ca = fs.readFileSync(path.resolve(sslCaPath));
    }
    
    console.log('✅ SSL certificates loaded successfully');
    return options;
  } catch (error) {
    console.error('❌ Failed to load SSL certificates:', error);
    return null;
  }
};

// HTTP to HTTPS redirect middleware (for production behind reverse proxy)
const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  // Check if behind a reverse proxy (common in production)
  const forwardedProto = req.headers['x-forwarded-proto'];
  const isHttps = req.secure || forwardedProto === 'https';
  
  if (isProduction && !isHttps) {
    // Redirect to HTTPS
    const httpsUrl = `https://${req.headers.host}${req.url}`;
    return res.redirect(301, httpsUrl);
  }
  
  next();
};

// Trust first proxy (Railway, nginx, load balancer) for rate limits & x-forwarded-proto
app.set('trust proxy', 1);

if (isProduction) {
  app.use(enforceHttps);
}

// Security Headers with Helmet
app.use(
  helmet({
    // Content Security Policy
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://www.paypal.com", "https://www.paypalobjects.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        connectSrc: ["'self'", "https://api-m.paypal.com", "https://api-m.sandbox.paypal.com", process.env.FRONTEND_URL || "http://localhost:5173"],
        frameSrc: ["'self'", "https://www.paypal.com", "https://www.sandbox.paypal.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    // HTTP Strict Transport Security
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    // Prevent clickjacking
    frameguard: {
      action: 'deny',
    },
    // Prevent MIME type sniffing
    noSniff: true,
    // XSS Protection (legacy browsers)
    xssFilter: true,
    // Referrer Policy
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
    // Don't advertise Express
    hidePoweredBy: true,
  })
);

// CORS with origin validation
const allowedOrigins = [
  process.env.FRONTEND_URL || "http://localhost:5173",
  "http://localhost:5173",
  "http://localhost:3000",
  // Add production domains here
].filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Log rejected origins for debugging
      console.warn(`CORS blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token'],
  })
);
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// Response compression for better performance
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses with this request header
    if (req.headers['x-no-compression']) return false;
    // Use compression for responses larger than 1KB
    return compression.filter(req, res);
  },
  level: 6, // Balanced compression level (1-9)
  threshold: 1024, // Only compress responses larger than 1KB
}));

const REQUEST_TIMEOUT_MS = parseInt(process.env.REQUEST_TIMEOUT_MS || '15000', 10);

app.use((req: Request, res: Response, next: NextFunction) => {
  const sendTimeout = () => {
    if (!res.headersSent) {
      console.error(`Request timeout: ${req.method} ${req.path}`);
      res.status(504).json({
        success: false,
        error: 'Gateway Timeout',
        message: 'The request took too long to process. Please try again.',
      });
    }
  };

  req.setTimeout(REQUEST_TIMEOUT_MS, sendTimeout);
  res.setTimeout(REQUEST_TIMEOUT_MS, sendTimeout);
  next();
});

// CSRF Protection - Double Submit Cookie Pattern
// Sets CSRF token cookie on all requests
app.use(csrfTokenSetter);
// Verifies CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
app.use(csrfProtection);

// CSRF token endpoint for SPA initialization
app.get('/api/csrf-token', getCsrfTokenHandler);

// Tiered rate limits: global 300/15m · admin login 10/15m · PayPal 30/15m · contact 5/h
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,     // Return rate limit info in headers
  legacyHeaders: false,      // Disable deprecated X-RateLimit headers
  message: {
    success: false,
    error: 'Too many requests, please try again later.',
  },
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/api/health';
  },
});

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,                   // Limit each IP to 10 login attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many login attempts, please try again later.',
  },
});

const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many payment attempts, please try again later.',
  },
});

const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many messages sent, please try again later.',
  },
});

// Rate limiting for order creation
const orderLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour
  max: 30,                    // Limit each IP to 30 orders per hour
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'Too many orders, please try again later.',
  },
});

app.use('/api/', apiLimiter);
app.use('/api/admin/login', authLimiter);
app.use('/api/paypal', paymentLimiter);
app.use('/api/contact', contactLimiter);
app.post('/api/orders', orderLimiter);

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// PayPal API Configuration
const PAYPAL_API =
  process.env.PAYPAL_MODE === "live"
    ? "https://api-m.paypal.com"
    : "https://api-m.sandbox.paypal.com";

const PAYPAL_HTTP_TIMEOUT_MS = parseInt(process.env.PAYPAL_HTTP_TIMEOUT_MS || '10000', 10);

/** PayPal HTTP with AbortController timeout (10s default). */
async function paypalFetch(
  url: string,
  init: RequestInit = {}
): Promise<globalThis.Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), PAYPAL_HTTP_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('PayPal request timed out');
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Types
interface PayPalItem {
  name: string;
  quantity: number;
  price: number;
}

interface CreatePaymentRequest {
  amount: string;
  currency: string;
  description: string;
  customerInfo: {
    fullName: string;
    email: string;
    phone?: string;
    address?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  breakdown?: {
    subtotal: string;
    shipping: string;
    tax: string;
  };
  items: PayPalItem[];
}

/**
 * Minimal PayPal response shapes used in this file.
 * Expand these if you need additional fields.
 */
interface PayPalAuthResponse {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  [k: string]: any;
}

interface PayPalOrderResponse {
  id: string;
  status?: string;
  links?: Array<{ href: string; rel: string; method: string }>;
  payer?: any;
  purchase_units?: any[];
  [k: string]: any;
}

interface PayPalCaptureResponse {
  id: string;
  status?: string;
  [k: string]: any;
}

interface PayPalRefundResponse {
  id?: string;
  status?: string;
  [k: string]: any;
}

// Helper: typed JSON parser
async function parseJson<T = any>(res: globalThis.Response): Promise<T> {
  return (await res.json()) as T;
}

// Get PayPal Access Token
// Token cache for PayPal access tokens (reduces API calls for 1000+ users)
let cachedPayPalToken: { token: string; expiresAt: number } | null = null;

async function fetchPayPalAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID || "";
  const secret = process.env.PAYPAL_SECRET || "";
  const auth = Buffer.from(`${clientId}:${secret}`).toString("base64");

  const response = await paypalFetch(`${PAYPAL_API}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error("PayPal Auth Error:", errorData);
    throw new Error(`PayPal Auth Failed: ${response.status}`);
  }

  const data = await parseJson<PayPalAuthResponse>(response);
  if (!data.access_token) throw new Error("No access token returned from PayPal");

  cachedPayPalToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in || 32400) * 1000,
  };

  return data.access_token;
}

async function getPayPalAccessToken(): Promise<string> {
  if (cachedPayPalToken && cachedPayPalToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedPayPalToken.token;
  }

  return withRetry(fetchPayPalAccessToken, { retries: 3, baseMs: 200 });
}

// API Routes
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/contact", contactRouter);
app.use("/api/admin", adminRouter);
app.use("/api/activity", activityRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/coupons", couponsRouter);

// Routes

// Health check - enhanced for production monitoring
app.get("/api/health", async (req: Request, res: Response) => {
  const startTime = Date.now();
  let dbStatus = "unknown";
  let dbLatency = 0;
  
  try {
    const dbStart = Date.now();
    await sql`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    dbStatus = "connected";
  } catch (error) {
    dbStatus = "disconnected";
    console.error("Health check - DB error:", error);
  }
  
  const isHealthy = dbStatus === "connected";
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "OK" : "DEGRADED",
    message: isHealthy ? "All systems operational" : "Some services unavailable",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: {
        status: dbStatus,
        latency_ms: dbLatency,
      },
      paypal: {
        mode: process.env.PAYPAL_MODE || "sandbox",
        api: PAYPAL_API,
      },
    },
    responseTime_ms: Date.now() - startTime,
  });
});

// Test PayPal connection
app.get("/api/paypal/test", async (req: Request, res: Response) => {
  try {
    const accessToken = await getPayPalAccessToken();
    res.json({
      success: true,
      message: "PayPal connection successful",
      hasToken: !!accessToken,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || "PayPal connection failed",
    });
  }
});

// Create PayPal Payment
app.post("/api/paypal/create-payment", async (req: Request, res: Response) => {
  try {
    const body = req.body as CreatePaymentRequest;

    const { amount, currency, description, customerInfo, breakdown, items } = body;

    // Validation
    if (!amount || !currency || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: amount, currency, items",
      });
    }

    if (!customerInfo || !customerInfo.email) {
      return res.status(400).json({
        success: false,
        error: "Customer information is required",
      });
    }

    console.log("Creating PayPal payment:", {
      amount,
      currency,
      itemCount: items.length,
      email: customerInfo.email,
      breakdown: breakdown || "calculated",
    });

    // Get access token
    const accessToken = await getPayPalAccessToken();

    // Use breakdown from frontend if provided, otherwise calculate
    let subtotal: number, shipping: number, tax: number;
    
    if (breakdown) {
      // Use the breakdown sent from frontend (ensures consistency)
      subtotal = parseFloat(breakdown.subtotal);
      shipping = parseFloat(breakdown.shipping);
      tax = parseFloat(breakdown.tax);
      
      console.log("✅ Using frontend breakdown:", { subtotal, shipping, tax });
    } else {
      // Fallback: Calculate breakdown (for backwards compatibility)
      subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
      shipping = subtotal > 1000 ? 0 : 50;
      tax = subtotal * 0.18;
      
      console.log("⚠️ Calculated breakdown (no frontend data):", { subtotal, shipping, tax });
    }

    // Verify amount matches breakdown (prevent mismatch errors)
    const calculatedTotal = subtotal + shipping + tax;
    const providedTotal = parseFloat(amount);
    const difference = Math.abs(calculatedTotal - providedTotal);
    
    if (difference > 0.01) {
      console.error("❌ Amount mismatch detected:", {
        provided: providedTotal,
        calculated: calculatedTotal,
        difference: difference,
      });
      return res.status(400).json({
        success: false,
        error: "Amount mismatch",
        message: `Total amount (${providedTotal}) doesn't match breakdown (${calculatedTotal.toFixed(2)})`,
      });
    }

    // Create order payload
    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          description: description || "Order from Lab Door Customs",
          amount: {
            currency_code: currency,
            value: amount,
            breakdown: {
              item_total: {
                currency_code: currency,
                value: subtotal.toFixed(2),
              },
              shipping: {
                currency_code: currency,
                value: shipping.toFixed(2),
              },
              tax_total: {
                currency_code: currency,
                value: tax.toFixed(2),
              },
            },
          },
          items: items.map((item) => ({
            name: item.name,
            unit_amount: {
              currency_code: currency,
              value: item.price.toFixed(2),
            },
            quantity: item.quantity.toString(),
            category: "PHYSICAL_GOODS",
          })),
        },
      ],
      application_context: {
        return_url: `${process.env.FRONTEND_URL}/payment/success`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        brand_name: "Lab Door Customs",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    };

    // Log payload being sent to PayPal for verification
    console.log("📤 Sending to PayPal sandbox:", JSON.stringify({
      amount: orderPayload.purchase_units[0].amount,
      items: orderPayload.purchase_units[0].items,
    }, null, 2));

    // Create order with PayPal
    const response = await paypalFetch(`${PAYPAL_API}/v2/checkout/orders`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(orderPayload),
    });

    if (!response.ok) {
      const errorData = await parseJson<any>(response);
      console.error("PayPal API Error:", errorData);
      throw new Error(`PayPal API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await parseJson<PayPalOrderResponse>(response);

    console.log("✅ PayPal order created:", data?.id);

    // Return approval URL to frontend
    res.json({
      success: true,
      orderId: data.id,
      links: data.links,
      status: data.status,
    });
  } catch (error: any) {
    console.error("❌ Create payment error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to create payment",
    });
  }
});

// Idempotency tracking for captures (prevent duplicate captures)
const captureAttempts = new Map<string, { status: string; timestamp: number; captureId?: string }>();
const CAPTURE_TIMEOUT = 5 * 60 * 1000; // 5 minutes

// Clean old capture attempts periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of captureAttempts.entries()) {
    if (now - value.timestamp > CAPTURE_TIMEOUT) {
      captureAttempts.delete(key);
    }
  }
}, 60000); // Every minute

// Capture PayPal Payment (after user approves) - with retry and idempotency
app.post("/api/paypal/capture-payment/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const idempotencyKey = req.headers['x-idempotency-key'] as string || orderId;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Order ID is required",
      });
    }

    // Check for duplicate capture attempt
    const existingAttempt = captureAttempts.get(idempotencyKey);
    if (existingAttempt) {
      if (existingAttempt.status === 'processing') {
        return res.status(409).json({
          success: false,
          error: "Payment capture already in progress",
          message: "Please wait for the current capture to complete",
        });
      }
      if (existingAttempt.status === 'completed' && existingAttempt.captureId) {
        console.log(`Returning cached capture result for ${idempotencyKey}`);
        return res.json({
          success: true,
          captureId: existingAttempt.captureId,
          status: 'COMPLETED',
          cached: true,
        });
      }
    }

    // Mark as processing
    captureAttempts.set(idempotencyKey, { status: 'processing', timestamp: Date.now() });

    console.log("Capturing PayPal payment:", orderId);

    const data = await withRetry(async () => {
      const accessToken = await getPayPalAccessToken();

      const response = await paypalFetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}/capture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": idempotencyKey,
        },
      });

      // Handle specific PayPal errors
      if (response.status === 422) {
        // Order already captured or invalid state
        const errorData = await parseJson<any>(response);
        const issue = errorData?.details?.[0]?.issue;
        
        if (issue === 'ORDER_ALREADY_CAPTURED') {
          // Return success for already captured orders
          console.log(`Order ${orderId} was already captured`);
          return { id: orderId, status: 'COMPLETED', alreadyCaptured: true };
        }
        
        throw new Error(`PayPal Error: ${issue || 'Unprocessable Entity'}`);
      }

      if (!response.ok) {
        const errorData = await parseJson<any>(response);
        console.error("PayPal Capture Error:", errorData);
        throw new Error(`PayPal Capture Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      return await parseJson<PayPalCaptureResponse>(response);
    }, { retries: 3, baseMs: 200 });

    // Mark as completed
    captureAttempts.set(idempotencyKey, { 
      status: 'completed', 
      timestamp: Date.now(),
      captureId: data.id,
    });

    console.log("✅ Payment captured:", data?.id);

    res.json({
      success: true,
      captureId: data.id,
      status: data.status,
      payer: (data as any).payer,
      purchase_units: (data as any).purchase_units,
    });
  } catch (error: any) {
    console.error("❌ Capture payment error:", error);
    
    // Remove from processing state on error
    const idempotencyKey = req.headers['x-idempotency-key'] as string || req.params.orderId;
    captureAttempts.delete(idempotencyKey);
    
    res.status(500).json({
      success: false,
      error: error.message || "Failed to capture payment",
    });
  }
});

// Get Order Details
app.get("/api/paypal/order/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;

    if (!orderId) {
      return res.status(400).json({
        success: false,
        error: "Order ID is required",
      });
    }

    // Get access token
    const accessToken = await getPayPalAccessToken();

    const response = await paypalFetch(`${PAYPAL_API}/v2/checkout/orders/${orderId}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to get order: ${response.status}`);
    }

    const data = await parseJson<PayPalOrderResponse>(response);

    res.json({
      success: true,
      order: data,
    });
  } catch (error: any) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to get order details",
    });
  }
});

// Refund Payment
app.post("/api/paypal/refund/:captureId", async (req: Request, res: Response) => {
  try {
    const { captureId } = req.params;
    const { amount, currency } = req.body;

    if (!captureId) {
      return res.status(400).json({
        success: false,
        error: "Capture ID is required",
      });
    }

    // Get access token
    const accessToken = await getPayPalAccessToken();

    const refundPayload: any = {};

    if (amount && currency) {
      refundPayload.amount = {
        currency_code: currency,
        value: amount,
      };
    }

    const response = await paypalFetch(`${PAYPAL_API}/v2/payments/captures/${captureId}/refund`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(refundPayload),
    });

    if (!response.ok) {
      const errorData = await parseJson<any>(response);
      console.error("Refund Error:", errorData);
      throw new Error(`Refund failed: ${response.status}`);
    }

    const data = await parseJson<PayPalRefundResponse>(response);

    console.log("✅ Refund processed:", data?.id);

    res.json({
      success: true,
      refundId: data.id,
      status: data.status,
    });
  } catch (error: any) {
    console.error("Refund error:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Failed to process refund",
    });
  }
});

// PayPal Webhook Signature Verification
async function verifyPayPalWebhook(
  req: Request,
  webhookId: string
): Promise<{ verified: boolean; error?: string }> {
  try {
    const accessToken = await getPayPalAccessToken();
    
    // Get PayPal headers for verification
    const transmissionId = req.headers['paypal-transmission-id'] as string;
    const transmissionTime = req.headers['paypal-transmission-time'] as string;
    const certUrl = req.headers['paypal-cert-url'] as string;
    const authAlgo = req.headers['paypal-auth-algo'] as string;
    const transmissionSig = req.headers['paypal-transmission-sig'] as string;

    // Check if all required headers are present
    if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
      console.warn("⚠️ Missing PayPal webhook headers");
      return { verified: false, error: "Missing required PayPal headers" };
    }

    // Verify the webhook signature with PayPal
    const verifyResponse = await paypalFetch(`${PAYPAL_API}/v1/notifications/verify-webhook-signature`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: req.body,
      }),
    });

    if (!verifyResponse.ok) {
      const errorText = await verifyResponse.text();
      console.error("PayPal verification API error:", errorText);
      return { verified: false, error: "PayPal verification API error" };
    }

    const verifyResult = await verifyResponse.json() as { verification_status: string };
    
    if (verifyResult.verification_status === "SUCCESS") {
      console.log("✅ PayPal webhook signature verified");
      return { verified: true };
    } else {
      console.warn("⚠️ PayPal webhook verification failed:", verifyResult.verification_status);
      return { verified: false, error: `Verification status: ${verifyResult.verification_status}` };
    }
  } catch (error: any) {
    console.error("Webhook verification error:", error);
    return { verified: false, error: error.message };
  }
}

// Webhook endpoint for PayPal notifications
app.post("/api/paypal/webhook", async (req: Request, res: Response) => {
  try {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    const webhookEvent = req.body;

    console.log("📨 PayPal Webhook Event:", webhookEvent?.event_type);

    // Verify webhook signature if PAYPAL_WEBHOOK_ID is configured
    if (webhookId) {
      const verification = await verifyPayPalWebhook(req, webhookId);
      
      if (!verification.verified) {
        console.error("❌ Webhook verification failed:", verification.error);
        // Return 200 to prevent PayPal from retrying, but log the issue
        // In production, you might want to alert on this
        return res.status(401).json({ 
          error: "Webhook verification failed",
          message: verification.error 
        });
      }
    } else {
      // Log warning if webhook ID is not configured (development mode)
      console.warn("⚠️ PAYPAL_WEBHOOK_ID not configured - skipping signature verification");
      console.warn("⚠️ This is a security risk in production!");
    }

    // Handle different webhook events
    switch (webhookEvent?.event_type) {
      case "PAYMENT.CAPTURE.COMPLETED": {
        console.log("✅ Payment completed:", webhookEvent.resource?.id);
        const captureId = webhookEvent.resource?.id;
        const orderId = webhookEvent.resource?.supplementary_data?.related_ids?.order_id;
        
        if (orderId) {
          try {
            // Check if order exists
            const existingOrder = await sql`
              SELECT id, status, items FROM orders WHERE paypal_order_id = ${orderId}
            `;
            
            if (existingOrder && existingOrder.length > 0) {
              // Update order status - use 'processing' as valid status
              await sql`
                UPDATE orders 
                SET payment_status = 'completed', 
                    status = CASE WHEN status = 'pending' THEN 'processing' ELSE status END,
                    paypal_capture_id = ${captureId},
                    updated_at = NOW()
                WHERE paypal_order_id = ${orderId}
              `;
              console.log(`📦 Order ${orderId} payment completed, status updated to processing`);
            } else {
              console.warn(`⚠️ Order not found for PayPal order ID: ${orderId}`);
            }
          } catch (dbError) {
            console.error("Database update error:", dbError);
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.DENIED": {
        console.log("❌ Payment denied:", webhookEvent.resource?.id);
        const deniedOrderId = webhookEvent.resource?.supplementary_data?.related_ids?.order_id;
        
        if (deniedOrderId) {
          try {
            // Check if order exists and get items for inventory restore
            const existingOrder = await sql`
              SELECT id, status, items FROM orders WHERE paypal_order_id = ${deniedOrderId}
            `;
            
            if (existingOrder && existingOrder.length > 0) {
              const order = existingOrder[0];
              const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
              
              // Restore inventory since payment failed
              for (const item of items) {
                await sql`
                  UPDATE products 
                  SET stock = stock + ${item.quantity},
                      is_out_of_stock = FALSE,
                      updated_at = NOW()
                  WHERE id = ${item.product_id}
                `;
              }
              console.log(`📦 Inventory restored for denied order ${deniedOrderId}`);
              
              await sql`
                UPDATE orders 
                SET payment_status = 'failed', 
                    status = 'cancelled',
                    updated_at = NOW()
                WHERE paypal_order_id = ${deniedOrderId}
              `;
              console.log(`📦 Order ${deniedOrderId} marked as failed/cancelled`);
            } else {
              console.warn(`⚠️ Order not found for PayPal order ID: ${deniedOrderId}`);
            }
          } catch (dbError) {
            console.error("Database update error:", dbError);
          }
        }
        break;
      }

      case "PAYMENT.CAPTURE.REFUNDED": {
        console.log("💰 Payment refunded:", webhookEvent.resource?.id);
        const refundedOrderId = webhookEvent.resource?.supplementary_data?.related_ids?.order_id;
        
        if (refundedOrderId) {
          try {
            // Check if order exists
            const existingOrder = await sql`
              SELECT id, status, items FROM orders WHERE paypal_order_id = ${refundedOrderId}
            `;
            
            if (existingOrder && existingOrder.length > 0) {
              const order = existingOrder[0];
              const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
              
              // Restore inventory on refund (if not already cancelled)
              if (order.status !== 'cancelled') {
                for (const item of items) {
                  await sql`
                    UPDATE products 
                    SET stock = stock + ${item.quantity},
                        is_out_of_stock = FALSE,
                        updated_at = NOW()
                    WHERE id = ${item.product_id}
                  `;
                }
                console.log(`📦 Inventory restored for refunded order ${refundedOrderId}`);
              }
              
              // Update payment_status to refunded, keep status as cancelled (valid state)
              await sql`
                UPDATE orders 
                SET payment_status = 'refunded', 
                    status = 'cancelled',
                    updated_at = NOW()
                WHERE paypal_order_id = ${refundedOrderId}
              `;
              console.log(`📦 Order ${refundedOrderId} marked as refunded`);
            } else {
              console.warn(`⚠️ Order not found for PayPal order ID: ${refundedOrderId}`);
            }
          } catch (dbError) {
            console.error("Database update error:", dbError);
          }
        }
        break;
      }

      case "CHECKOUT.ORDER.APPROVED": {
        console.log("👍 Checkout approved:", webhookEvent.resource?.id);
        const approvedOrderId = webhookEvent.resource?.id;
        
        // Log for tracking - actual capture happens on frontend callback
        if (approvedOrderId) {
          console.log(`📦 Checkout approved for PayPal order: ${approvedOrderId}, awaiting capture`);
        }
        break;
      }

      case "CHECKOUT.ORDER.COMPLETED": {
        console.log("✅ Checkout completed:", webhookEvent.resource?.id);
        // This event indicates the full checkout flow is complete
        // Order should already be updated by PAYMENT.CAPTURE.COMPLETED
        break;
      }

      default:
        console.log("ℹ️ Unhandled event type:", webhookEvent?.event_type);
    }

    res.status(200).json({ received: true });
  } catch (error: any) {
    console.error("Webhook error:", error);
    // Return 200 to prevent PayPal from retrying failed webhooks
    // Log the error for investigation
    res.status(200).json({ received: true, error: "Processing error logged" });
  }
});

// 404 handler - must be before error handler
app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: "Route not found",
    path: req.path,
  });
});

// Error handling middleware - MUST have 4 parameters
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error("💥 Server error:", err);

  res.status(500).json({
    success: false,
    error: err.message || "Internal server error",
    // Only in development
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// Start server
const PORT = process.env.PORT || 5000;
const HTTPS_PORT = process.env.HTTPS_PORT || 443;
const sslConfig = getSSLConfig();

// Create appropriate server based on SSL configuration
let server: ReturnType<typeof app.listen>;

if (sslConfig && isProduction) {
  // HTTPS server for production with SSL certificates
  server = https.createServer(sslConfig, app).listen(HTTPS_PORT, () => {
    console.log("╔════════════════════════════════════════╗");
    console.log("║   🔒 HTTPS Server Running!            ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`📍 HTTPS Port: ${HTTPS_PORT}`);
    console.log(`🔐 SSL: Enabled`);
    console.log(`🌍 Frontend: ${process.env.FRONTEND_URL || "https://localhost"}`);
    console.log(`💳 PayPal Mode: ${process.env.PAYPAL_MODE || "sandbox"}`);
    console.log(`🔗 PayPal API: ${PAYPAL_API}`);
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
  });
  
  // Also start HTTP server to redirect to HTTPS
  app.listen(PORT, () => {
    console.log(`📍 HTTP Port: ${PORT} (redirecting to HTTPS)`);
  });
} else {
  // HTTP server for development or when SSL is not configured
  server = app.listen(PORT, () => {
    console.log("╔════════════════════════════════════════╗");
    console.log("║   🚀 Server Running Successfully!     ║");
    console.log("╚════════════════════════════════════════╝");
    console.log(`📍 Port: ${PORT}`);
    if (isProduction && !sslConfig) {
      console.log(`⚠️  WARNING: Running in production without SSL!`);
      console.log(`   Set SSL_KEY_PATH and SSL_CERT_PATH for HTTPS`);
    }
    console.log(`🌍 Frontend: ${process.env.FRONTEND_URL || "http://localhost:5173"}`);
    console.log(`💳 PayPal Mode: ${process.env.PAYPAL_MODE || "sandbox"}`);
    console.log(`🔗 PayPal API: ${PAYPAL_API}`);
    console.log(`⏰ Started: ${new Date().toLocaleString()}`);
    console.log("");
    console.log("📋 Available endpoints:");
    console.log("   GET  /api/health");
    console.log("");
    console.log("   💳 PayPal Endpoints:");
    console.log("   GET  /api/paypal/test");
    console.log("   POST /api/paypal/create-payment");
    console.log("   POST /api/paypal/capture-payment/:orderId");
    console.log("   GET  /api/paypal/order/:orderId");
    console.log("   POST /api/paypal/refund/:captureId");
    console.log("   POST /api/paypal/webhook");
    console.log("");
    console.log("   📦 Product Endpoints:");
    console.log("   GET    /api/products");
    console.log("   GET    /api/products/:id");
    console.log("   POST   /api/products");
    console.log("   PUT    /api/products/:id");
    console.log("   DELETE /api/products/:id");
    console.log("");
    console.log("   📋 Order Endpoints:");
    console.log("   GET    /api/orders");
    console.log("   POST   /api/orders");
    console.log("   GET    /api/orders/:id");
    console.log("   PUT    /api/orders/:id");
    console.log("   PATCH  /api/orders/:id/status");
    console.log("");
    console.log("   📧 Contact Endpoints:");
    console.log("   GET    /api/contact");
    console.log("   POST   /api/contact");
    console.log("   GET    /api/contact/:id");
    console.log("");
    console.log("✅ Ready to accept connections!");
    console.log("════════════════════════════════════════");
  });
}

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
  });
});

process.on("SIGINT", () => {
  console.log("SIGINT signal received: closing HTTP server");
  server.close(() => {
    console.log("HTTP server closed");
    process.exit(0);
  });
});
