// server/src/server.ts - Production Ready REST API
import express from "express";
import type { Request, Response, NextFunction } from "express";
import https from "https";
import fs from "fs";
import path from "path";
import cors from "cors";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import { emailService } from './lib/email';
import sql, {
  withRetry,
  getPoolStats,
  runBootstrapTask,
  pingDatabaseWithTimeout,
} from './lib/db';
import { getLanIPv4Addresses, getPrimaryLanIPv4 } from './lib/lanAddress';
import { sanitizeCustomerInfo } from './utils/sanitizeCustomer';
import { clientErrorMessage } from './lib/safeError';
import {
  validateCartItems,
  resolveCouponDiscount,
  calculateCheckoutPricing,
  calculateVolumeDiscount,
  createPendingPayPalOrder,
  cancelPendingOrderAndRestoreStock,
  extractPayPalCaptureAmount,
  amountsMatch,
  type CheckoutCartItemInput,
} from './lib/paypalCheckout';
import { csrfTokenSetter, csrfProtection, getCsrfTokenHandler } from './middleware/csrf';
import { requireCloudflareProxy } from './middleware/cloudflare';
import { getClientIp } from './lib/clientIp';
import { logger } from './lib/logger';
import { initSentry, captureException } from './lib/sentry';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogMiddleware } from './middleware/requestLog';
import { getRequestPath, getRequestTimeoutMs } from './lib/requestTiming';
import {
  buildCreatePaymentKey,
  buildCapturePaymentKey,
  claimIdempotencyKey,
  completeIdempotencyKey,
  failIdempotencyKey,
  ensureIdempotencyTable,
  reclaimFailedIdempotencyKey,
} from './lib/paymentIdempotency';
import { warmCaches } from './lib/cacheWarm';
import { connectRedis, isRedisEnabled, getRedisClient } from './lib/redis';
import { mountRateLimits } from './middleware/rateLimits';
import { startMaintenanceJobs } from './lib/maintenanceJobs';
import { ensureActivityLogsTable } from './lib/activitySchema';
import { registerGracefulShutdown } from './lib/gracefulShutdown';
import { POLICY_ACCEPTANCE_REQUIRED_MESSAGE } from './lib/returnPolicy';
import {
  reserveCouponForOrder,
  getCouponForOrder,
} from './lib/couponReservation';
import {
  completeOrderPaymentCapture,
  revertCaptureAmountMismatch,
} from './lib/paymentReconciliation';
import { sendPostCaptureNotifications } from './lib/postPaymentCapture';
import { createPayPalWebhookHandler } from './lib/paypalWebhookHandler';
import { ensureOrderPaymentSchema } from './lib/orderSchemaMigrations';
import {
  PAYPAL_API,
  paypalFetch,
  getPayPalAccessToken,
  parseJson,
} from './lib/paypalClient';
import {
  orderAccessMatches,
  getOrderAccessTokenFromRequest,
} from './lib/orderTokens';
import { parseCaptureFromPayPalOrder } from './lib/paypalWebhookUtils';
import {
  ensureCheckoutExchangeTable,
  createCheckoutExchangeCode,
  redeemCheckoutExchangeCode,
} from './lib/orderCheckoutExchange';
import { ensureOrderAccessExchangeTable } from './lib/orderAccessExchange';
import { ensureRlsPolicies } from './lib/rlsMigration';
import { assertJwtSecretForProduction } from './lib/jwtSecret';
import { purgeLegacyAdminSessions } from './lib/adminSessionMigration';
import { mountFrontend } from './lib/serveFrontend';
import { registerProcessErrorHandlers } from './lib/processErrorHandlers';

// Import routes
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import contactRouter from "./routes/contact";
import adminRouter, { verifyAdmin } from "./routes/admin";
import activityRouter from "./routes/activity";
import reviewsRouter from "./routes/reviews";
import couponsRouter from "./routes/coupons";

dotenv.config();
initSentry();
registerProcessErrorHandlers();

// Validate required environment variables at startup (mirrors scripts/validate-env.mjs)
const validateEnvVars = () => {
  const isProd = process.env.NODE_ENV === 'production';

  const required = ['DATABASE_URL'];
  const requiredProduction = [
    'FRONTEND_URL',
    'ADMIN_PASSWORD_HASH',
    'ADMIN_USERNAME',
    'JWT_SECRET',
    'PAYPAL_WEBHOOK_ID',
    'REDIS_URL',
    'SENTRY_DSN',
    'RESEND_API_KEY',
    'PAYPAL_CLIENT_ID',
    'PAYPAL_SECRET',
    'ORDER_TOKEN_ENCRYPTION_KEY',
    'IP_SALT',
  ];

  const missing = required.filter((v) => !process.env[v]?.trim());
  if (missing.length > 0) {
    logger.error({ missing }, 'Missing required environment variables');
    process.exit(1);
  }

  if (isProd) {
    const missingProd = requiredProduction.filter((v) => !process.env[v]?.trim());
    if (missingProd.length > 0) {
      logger.error({ missing: missingProd }, 'Missing production environment variables');
      process.exit(1);
    }

    if (process.env.TRUST_CLOUDFLARE !== 'true') {
      logger.error('TRUST_CLOUDFLARE=true is required when NODE_ENV=production');
      process.exit(1);
    }

    assertJwtSecretForProduction();

    const paypalMode = (process.env.PAYPAL_MODE || 'sandbox').toLowerCase();
    if (paypalMode !== 'live' && process.env.REQUIRE_PAYPAL_LIVE !== 'false') {
      logger.error('PAYPAL_MODE must be "live" in production (set REQUIRE_PAYPAL_LIVE=false to override)');
      process.exit(1);
    }
  } else {
    const recommended = ['ADMIN_USERNAME', 'JWT_SECRET', 'RESEND_API_KEY'];
    const missingRecommended = recommended.filter((v) => !process.env[v]?.trim());
    if (missingRecommended.length > 0) {
      logger.warn({ missing: missingRecommended }, 'Missing recommended environment variables');
    }
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      logger.warn('JWT_SECRET should be at least 32 characters for security');
    }
  }
};

validateEnvVars();

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

app.use(requestIdMiddleware);

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
    
    logger.info('SSL certificates loaded successfully');
    return options;
  } catch (error) {
    logger.error({ err: error }, 'Failed to load SSL certificates');
    return null;
  }
};

/** Production: redirect plain HTTP requests behind Railway/proxy (x-forwarded-proto). */
const enforceHttps = (req: Request, res: Response, next: NextFunction) => {
  const forwardedProto = (req.headers['x-forwarded-proto'] as string | undefined)
    ?.split(',')[0]
    ?.trim();

  if (isProduction && forwardedProto === 'http') {
    const host = req.headers.host || process.env.PUBLIC_HOST || '';
    return res.redirect(301, `https://${host}${req.url}`);
  }

  next();
};

// Trust first proxy (Railway, nginx, load balancer) for rate limits & x-forwarded-proto
app.set('trust proxy', 1);

if (isProduction) {
  app.use(enforceHttps);
}

// Block direct Railway access when Cloudflare proxy is enabled (see TRUST_CLOUDFLARE)
app.use(requireCloudflareProxy);

const frontendOrigin = process.env.FRONTEND_URL || 'http://localhost:5173';

const helmetCommon = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://www.paypal.com", "https://www.paypalobjects.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "https://api-m.paypal.com", "https://api-m.sandbox.paypal.com", frontendOrigin],
      frameSrc: ["'self'", "https://www.paypal.com", "https://www.sandbox.paypal.com"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: isProduction ? [] : null,
    },
  },
  frameguard: { action: 'deny' as const },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' as const },
  hidePoweredBy: true,
};

// HSTS only in production (avoids pinning localhost during dev)
app.use(
  helmet(
    isProduction
      ? {
          ...helmetCommon,
          hsts: {
            maxAge: 31536000,
            includeSubDomains: true,
            preload: true,
          },
        }
      : {
          ...helmetCommon,
          hsts: false,
        }
  )
);

// CORS with origin validation (per-request so no-origin rules can use req.path)
const extraOrigins =
  process.env.ALLOWED_ORIGINS?.split(',')
    .map((o) => o.trim())
    .filter(Boolean) ?? [];

const allowedOrigins = [
  process.env.FRONTEND_URL || 'http://localhost:5173',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  ...extraOrigins,
].filter(Boolean);

/** Allow phones/tablets on the same Wi‑Fi to hit the dev frontend (non-production only). */
const isDevLanOrigin = (origin: string): boolean => {
  if (isProduction) return false;
  try {
    const { hostname, port } = new URL(origin);
    const devPorts = new Set(['5173', '3000', '4173', '']);
    if (!devPorts.has(port)) return false;
    if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
    if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname)) return true;
    return false;
  } catch {
    return false;
  }
};

const corsBaseOptions = {
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'] as string[],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Order-Access-Token'],
};

/** Server-to-server paths allowed without Origin in production (health, webhooks). */
const NO_ORIGIN_ALLOWED_PREFIXES = [
  '/api/health',
  '/health',
  '/api/paypal/webhook',
];

app.use((req: Request, res: Response, next: NextFunction) => {
  cors({
    ...corsBaseOptions,
    origin: (origin, callback) => {
      if (!origin) {
        if (
          process.env.NODE_ENV !== 'production' ||
          NO_ORIGIN_ALLOWED_PREFIXES.some((p) => req.path.startsWith(p))
        ) {
          return callback(null, true);
        }
        logger.warn({ path: req.path }, 'CORS blocked request with no origin');
        return callback(new Error('Not allowed by CORS'));
      }

      const allowOrigin =
        allowedOrigins.includes(origin) ||
        isDevLanOrigin(origin) ||
        (!isProduction && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));

      if (allowOrigin) {
        // Must reflect the request origin (not *) when credentials: true
        return callback(null, origin);
      }

      logger.warn({ origin }, 'CORS blocked origin');
      callback(new Error('Not allowed by CORS'));
    },
  })(req, res, next);
});

// PayPal webhooks must use raw JSON body for signature verification (before express.json)
app.post(
  '/api/paypal/webhook',
  express.raw({ type: 'application/json', limit: '1mb' }),
  createPayPalWebhookHandler(isProduction)
);

app.use(express.json({ limit: "1mb" }));
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

app.use((req: Request, res: Response, next: NextFunction) => {
  const path = getRequestPath(req);
  const timeoutMs = getRequestTimeoutMs(req);

  const sendTimeout = () => {
    const elapsedMs = Date.now() - (req.requestStartMs ?? Date.now());
    if (!res.headersSent) {
      req.log?.warn(
        {
          method: req.method,
          path,
          timeoutMs,
          elapsedMs,
          headersSent: res.headersSent,
          pool: getPoolStats(),
        },
        'Request timeout'
      );
      res.status(504).json({
        success: false,
        error: 'Gateway Timeout',
        message: 'The request took too long to process. Please try again.',
      });
    } else {
      req.log?.warn(
        {
          method: req.method,
          path,
          timeoutMs,
          elapsedMs,
          headersSent: true,
          pool: getPoolStats(),
        },
        'Request timeout (response already sent)'
      );
    }
  };

  req.setTimeout(timeoutMs, sendTimeout);
  res.setTimeout(timeoutMs, sendTimeout);
  next();
});

// CSRF Protection - Double Submit Cookie Pattern
// Sets CSRF token cookie on all requests
app.use(csrfTokenSetter);
// Verifies CSRF token on state-changing requests (POST, PUT, DELETE, PATCH)
app.use(csrfProtection);

// CSRF token endpoint for SPA initialization
app.get('/api/csrf-token', getCsrfTokenHandler);

mountRateLimits(app);

/** False until bootstrap() finishes — tests skip bootstrap and stay ready. */
let serverReady = process.env.NODE_ENV === 'test';

const STARTUP_ALLOWED_PATHS = new Set(['/api/health', '/health', '/api/csrf-token']);

app.use((req: Request, res: Response, next: NextFunction) => {
  if (serverReady || STARTUP_ALLOWED_PATHS.has(req.path)) {
    return next();
  }
  res.status(503).json({
    success: false,
    error: 'Server starting',
    message: 'Database migrations are still running. Please retry in a few seconds.',
  });
});

app.use(requestLogMiddleware);

// Types
interface PayPalItem {
  name: string;
  quantity: number;
  price: number;
}

interface CreatePaymentRequest {
  currency: string;
  description?: string;
  coupon_code?: string;
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
  items: CheckoutCartItemInput[];
  /** Required — customer must accept no-refund / replacement-only policy before checkout. */
  policy_accepted?: boolean;
  /** Ignored — totals are calculated server-side from DB prices. */
  amount?: string;
  breakdown?: {
    subtotal: string;
    shipping: string;
    tax: string;
  };
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
  amount?: { value?: string; currency_code?: string };
  [k: string]: any;
}

/** Fetch real capture ID and amount when PayPal reports ORDER_ALREADY_CAPTURED. */
async function fetchPayPalOrderCaptureDetails(paypalOrderId: string) {
  const accessToken = await getPayPalAccessToken();
  const response = await paypalFetch(`${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch PayPal order details: ${response.status}`);
  }

  const data = await parseJson<Record<string, unknown>>(response);
  const { captureId, capturedAmount } = parseCaptureFromPayPalOrder(data);
  return { data, captureId, capturedAmount };
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

// Health check aliases (Railway / load balancers)
app.get("/health", (req: Request, res: Response) => {
  res.redirect(307, "/api/health");
});

// Health check - enhanced for production monitoring
app.get("/api/health", async (req: Request, res: Response) => {
  const startTime = Date.now();

  if (!serverReady) {
    return res.status(503).json({
      status: 'STARTING',
      timestamp: new Date().toISOString(),
      responseTime_ms: Date.now() - startTime,
    });
  }

  let dbStatus = "unknown";
  let dbLatency = 0;
  
  try {
    const dbStart = Date.now();
    await sql`SELECT 1`;
    dbLatency = Date.now() - dbStart;
    dbStatus = "connected";
  } catch (error) {
    dbStatus = "disconnected";
    logger.error("Health check - DB error:", error);
  }
  
  const redisConnected = Boolean(getRedisClient());
  const redisRequired = isProduction && Boolean(process.env.REDIS_URL?.trim());
  const redisOk = !redisRequired || redisConnected;
  const isHealthy = dbStatus === "connected" && redisOk;
  
  res.status(isHealthy ? 200 : 503).json({
    status: isHealthy ? "OK" : "DEGRADED",
    timestamp: new Date().toISOString(),
    responseTime_ms: Date.now() - startTime,
  });
});

app.get("/api/health/detail", verifyAdmin, async (_req: Request, res: Response) => {
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
    logger.error("Health detail - DB error:", error);
  }

  const redisConnected = Boolean(getRedisClient());
  const redisRequired = isProduction && Boolean(process.env.REDIS_URL?.trim());
  const redisOk = !redisRequired || redisConnected;

  res.json({
    status: dbStatus === "connected" && redisOk ? "OK" : "DEGRADED",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "development",
    services: {
      database: { status: dbStatus, latency_ms: dbLatency, ...getPoolStats() },
      paypal: { mode: process.env.PAYPAL_MODE || "sandbox", api: PAYPAL_API },
      redis: {
        enabled: isRedisEnabled(),
        connected: redisConnected,
        required: redisRequired,
        status: redisOk ? "connected" : "disconnected",
      },
    },
    responseTime_ms: Date.now() - startTime,
  });
});

// Test PayPal connection (admin only)
app.get("/api/paypal/test", verifyAdmin, async (req: Request, res: Response) => {
  try {
    const accessToken = await getPayPalAccessToken();
    res.json({
      success: true,
      message: "PayPal connection successful",
      hasToken: !!accessToken,
    });
  } catch (error: unknown) {
    res.status(500).json({
      success: false,
      error: clientErrorMessage(error, 'PayPal connection failed'),
    });
  }
});

// Create PayPal Payment (server-validated cart + pending order binding)
app.post("/api/paypal/create-payment", async (req: Request, res: Response) => {
  let idempotencyKey: string | undefined;
  let createdServerOrderId: string | undefined;

  try {
    const body = req.body as CreatePaymentRequest;
    const { currency = 'USD', description, items, coupon_code } = body;
    const customerInfo = body.customerInfo
      ? sanitizeCustomerInfo(body.customerInfo)
      : undefined;

    if (!items || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: "Missing required fields: items",
      });
    }

    if (!customerInfo?.email || !customerInfo?.fullName) {
      return res.status(400).json({
        success: false,
        error: "Customer name and email are required",
      });
    }

    if (body.policy_accepted !== true) {
      return res.status(400).json({
        success: false,
        error: 'Policy acceptance required',
        message: POLICY_ACCEPTANCE_REQUIRED_MESSAGE,
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(customerInfo.email)) {
      return res.status(400).json({
        success: false,
        error: "Invalid email format",
      });
    }

    const cartValidation = await validateCartItems(items);
    if (!cartValidation.ok) {
      return res.status(400).json({
        success: false,
        error: cartValidation.error,
        message: cartValidation.message,
      });
    }

    const lineItems = cartValidation.lineItems;
    const rawSubtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    const totalItemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);
    const volumePreview = calculateVolumeDiscount(rawSubtotal, totalItemCount);
    const couponSubtotal = Math.max(0, rawSubtotal - volumePreview.amount);

    let couponDiscount = 0;
    let couponId: string | undefined;
    try {
      const couponResult = await resolveCouponDiscount(
        coupon_code,
        couponSubtotal,
        customerInfo.email,
        lineItems.map((item) => ({
          product_id: item.product_id,
          price: item.price,
          quantity: item.quantity,
        }))
      );
      couponDiscount = couponResult.discount;
      couponId = couponResult.couponId;
    } catch (couponError: any) {
      return res.status(400).json({
        success: false,
        error: couponError.message || 'Invalid coupon',
      });
    }

    const pricing = calculateCheckoutPricing(rawSubtotal, totalItemCount, couponDiscount);

    if (body.amount) {
      const clientTotal = parseFloat(body.amount);
      if (!amountsMatch(pricing.total, clientTotal)) {
        return res.status(400).json({
          success: false,
          error: 'Amount mismatch',
          message: `Server total (${pricing.total.toFixed(2)}) does not match client total (${clientTotal.toFixed(2)})`,
        });
      }
    }

    idempotencyKey = buildCreatePaymentKey(
      req.headers['x-idempotency-key'] as string | undefined,
      customerInfo.email,
      items.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      coupon_code
    );

    const claim = await claimIdempotencyKey(idempotencyKey, 'create_payment');
    if (claim.type === 'completed') {
      logger.info(`Returning cached create-payment result for ${idempotencyKey}`);
      return res.json({ ...claim.response, cached: true });
    }
    if (claim.type === 'in_progress') {
      return res.status(409).json({
        success: false,
        error: 'Payment creation already in progress',
        message: 'A duplicate payment request was detected. Please wait.',
      });
    }
    if (claim.type === 'failed') {
      const reclaimed = await reclaimFailedIdempotencyKey(idempotencyKey, 'create_payment', 30);
      if (!reclaimed) {
        return res.status(409).json({
          success: false,
          error: 'Previous payment attempt failed',
          message: claim.error,
        });
      }
    }

    const pending = await createPendingPayPalOrder({
      customerInfo,
      lineItems,
      pricing,
      couponId,
    });
    createdServerOrderId = pending.order.id as string;

    if (couponId && pricing.couponDiscount > 0) {
      try {
        await reserveCouponForOrder(
          couponId,
          pending.order.id as string,
          customerInfo.email,
          pricing.couponDiscount
        );
      } catch (couponReserveError: unknown) {
        await cancelPendingOrderAndRestoreStock(createdServerOrderId).catch((err) =>
          logger.error('Rollback after coupon reservation failure:', err)
        );
        const message =
          couponReserveError instanceof Error ? couponReserveError.message : 'Coupon unavailable';
        return res.status(400).json({
          success: false,
          error: message,
        });
      }
    }

    logger.info('Creating PayPal payment for bound order:', {
      serverOrderId: pending.order.id,
      orderNumber: pending.orderNumber,
      total: pricing.total,
      itemCount: lineItems.length,
    });

    const accessToken = await getPayPalAccessToken();
    const subtotal = pricing.subtotal;
    const shipping = pricing.shipping;
    const tax = pricing.tax;
    const amount = pricing.total.toFixed(2);

    const checkoutExchangeCode = await createCheckoutExchangeCode(
      pending.order.id as string,
      pending.accessToken
    );

    const orderPayload = {
      intent: "CAPTURE",
      purchase_units: [
        {
          reference_id: pending.order.id,
          custom_id: pending.order.id,
          description: description || `Order ${pending.orderNumber}`,
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
              ...(pricing.discount > 0
                ? {
                    discount: {
                      currency_code: currency,
                      value: pricing.discount.toFixed(2),
                    },
                  }
                : {}),
            },
          },
          items: lineItems.map((item) => ({
            name: item.product_name,
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
        return_url: `${process.env.FRONTEND_URL}/payment/success?code=${encodeURIComponent(checkoutExchangeCode)}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        brand_name: "Lab Door Customs",
        landing_page: "BILLING",
        user_action: "PAY_NOW",
        shipping_preference: "NO_SHIPPING",
      },
    };

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
      logger.error("PayPal API Error:", errorData);
      await cancelPendingOrderAndRestoreStock(createdServerOrderId).catch((err) =>
        logger.error('Rollback after PayPal create failure:', err)
      );
      throw new Error(`PayPal API Error: ${response.status} - ${JSON.stringify(errorData)}`);
    }

    const data = await parseJson<PayPalOrderResponse>(response);

    const duplicatePayPalOrder = await sql`
      SELECT id FROM orders
      WHERE paypal_order_id = ${data.id} AND id != ${pending.order.id}
      LIMIT 1
    `;
    if (duplicatePayPalOrder.length) {
      await cancelPendingOrderAndRestoreStock(createdServerOrderId!).catch((err) =>
        logger.error('Rollback after duplicate PayPal order ID:', err)
      );
      await failIdempotencyKey(idempotencyKey, 'create_payment').catch(() => {});
      return res.status(409).json({
        success: false,
        error: 'PayPal order ID conflict',
        message: 'This payment could not be linked. Please try checkout again.',
      });
    }

    await sql`
      UPDATE orders
      SET paypal_order_id = ${data.id}, updated_at = NOW()
      WHERE id = ${pending.order.id}
    `;

    logger.info("✅ PayPal order created and bound:", data?.id, "→", pending.order.id);

    const responsePayload = {
      success: true,
      orderId: data.id,
      serverOrderId: pending.order.id,
      orderNumber: pending.orderNumber,
      total: pricing.total,
      links: data.links,
      status: data.status,
      couponId,
      discount: pricing.discount,
      volumeDiscount: pricing.volumeDiscount,
      couponDiscount: pricing.couponDiscount,
      idempotencyKey,
    };

    await completeIdempotencyKey(idempotencyKey, 'create_payment', responsePayload, {
      serverOrderId: pending.order.id,
      paypalOrderId: data.id,
    });

    res.json(responsePayload);
  } catch (error: any) {
    logger.error("❌ Create payment error:", error);
    if (createdServerOrderId) {
      await cancelPendingOrderAndRestoreStock(createdServerOrderId).catch((err) =>
        logger.error('Rollback after create-payment error:', err)
      );
    }
    if (idempotencyKey) {
      await failIdempotencyKey(idempotencyKey, 'create_payment').catch(() => {});
    }
    res.status(500).json({
      success: false,
      error: clientErrorMessage(error, 'Failed to create payment'),
    });
  }
});

// Capture PayPal Payment (after user approves) - bound to server order + amount validation
app.post("/api/paypal/capture-payment/:orderId", async (req: Request, res: Response) => {
  try {
    const { orderId: paypalOrderId } = req.params;
    const {
      serverOrderId,
      accessToken,
      couponId,
      discount_amount,
    } = req.body as {
      serverOrderId?: string;
      accessToken?: string;
      couponId?: string;
      discount_amount?: number;
    };
    const idempotencyKey = buildCapturePaymentKey(
      req.headers['x-idempotency-key'] as string | undefined,
      paypalOrderId
    );

    if (!paypalOrderId) {
      return res.status(400).json({
        success: false,
        error: "Order ID is required",
      });
    }

    if (!serverOrderId) {
      return res.status(400).json({
        success: false,
        error: "serverOrderId is required",
        message: "Payment must be tied to a server-created order",
      });
    }

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: "Token required",
        message: "Order access token is required to capture payment",
      });
    }

    const boundOrders = await sql`
      SELECT * FROM orders
      WHERE id = ${serverOrderId}
      AND paypal_order_id = ${paypalOrderId}
      LIMIT 1
    `;

    if (!boundOrders || boundOrders.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Order binding mismatch",
        message: "PayPal order is not linked to the provided server order",
      });
    }

    const boundOrder = boundOrders[0];

    if (!orderAccessMatches(boundOrder.access_token_hash as string, accessToken)) {
      return res.status(403).json({
        success: false,
        error: "Invalid order access token",
      });
    }

    if (boundOrder.payment_status === 'completed') {
      return res.json({
        success: true,
        captureId: boundOrder.paypal_capture_id,
        status: 'COMPLETED',
        serverOrderId,
        orderNumber: boundOrder.order_number,
        cached: true,
      });
    }

    if (boundOrder.payment_status !== 'pending') {
      return res.status(409).json({
        success: false,
        error: "Order is not awaiting payment",
      });
    }

    const captureClaim = await claimIdempotencyKey(idempotencyKey, 'capture_payment', 15);
    if (captureClaim.type === 'completed') {
      logger.info(`Returning cached capture result for ${idempotencyKey}`);
      return res.json({ ...captureClaim.response, cached: true });
    }
    if (captureClaim.type === 'in_progress') {
      return res.status(409).json({
        success: false,
        error: "Payment capture already in progress",
        message: "Please wait for the current capture to complete",
      });
    }
    if (captureClaim.type === 'failed') {
      if (boundOrder.payment_status === 'pending') {
        const reclaimed = await reclaimFailedIdempotencyKey(idempotencyKey, 'capture_payment', 15);
        if (!reclaimed) {
          return res.status(409).json({
            success: false,
            error: "Previous capture attempt failed",
            message: captureClaim.error,
          });
        }
      } else {
        return res.status(409).json({
          success: false,
          error: "Previous capture attempt failed",
          message: captureClaim.error,
        });
      }
    }

    logger.info("Capturing PayPal payment:", paypalOrderId, "for server order:", serverOrderId);

    type ResolvedCaptureDetails = Awaited<ReturnType<typeof fetchPayPalOrderCaptureDetails>>;

    const captureResult = await withRetry(async () => {
      const accessTokenPayPal = await getPayPalAccessToken();

      const response = await paypalFetch(`${PAYPAL_API}/v2/checkout/orders/${paypalOrderId}/capture`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessTokenPayPal}`,
          "Content-Type": "application/json",
          "PayPal-Request-Id": idempotencyKey,
        },
      });

      if (response.status === 422) {
        const errorData = await parseJson<any>(response);
        const issue = errorData?.details?.[0]?.issue;

        if (issue === 'ORDER_ALREADY_CAPTURED') {
          logger.info(`Order ${paypalOrderId} was already captured — resolving capture details`);
          const resolved = await fetchPayPalOrderCaptureDetails(paypalOrderId);
          if (!resolved.captureId) {
            throw new Error('Order already captured but capture ID could not be resolved');
          }
          return {
            data: {
              ...resolved.data,
              status: 'COMPLETED',
              alreadyCaptured: true,
            },
            resolved,
          };
        }

        throw new Error(`PayPal Error: ${issue || 'Unprocessable Entity'}`);
      }

      if (!response.ok) {
        const errorData = await parseJson<any>(response);
        logger.error("PayPal Capture Error:", errorData);
        throw new Error(`PayPal Capture Error: ${response.status} - ${JSON.stringify(errorData)}`);
      }

      return {
        data: await parseJson<PayPalCaptureResponse>(response),
        resolved: null as ResolvedCaptureDetails | null,
      };
    }, { retries: 3, baseMs: 200 });

    const data = captureResult.data;
    const resolvedAlreadyCaptured = captureResult.resolved;

    const capturedAmount =
      resolvedAlreadyCaptured?.capturedAmount ??
      extractPayPalCaptureAmount(data as Record<string, any>);
    const expectedTotal = parseFloat(boundOrder.total?.toString() || '0');

    if (capturedAmount != null && !amountsMatch(expectedTotal, capturedAmount)) {
      logger.error("❌ PayPal capture amount mismatch:", {
        expected: expectedTotal,
        captured: capturedAmount,
        serverOrderId,
        paypalOrderId,
      });

      const mismatchCaptureId =
        resolvedAlreadyCaptured?.captureId ||
        (data as any).purchase_units?.[0]?.payments?.captures?.[0]?.id ||
        (data as any).id ||
        null;

      if (mismatchCaptureId) {
        await revertCaptureAmountMismatch(serverOrderId, mismatchCaptureId);
      } else {
        await cancelPendingOrderAndRestoreStock(serverOrderId).catch(() => {});
      }

      await failIdempotencyKey(idempotencyKey, 'capture_payment').catch(() => {});
      return res.status(400).json({
        success: false,
        error: "Payment amount mismatch",
        message: "Payment was reversed because the captured amount did not match your order total",
      });
    }

    const captureId =
      resolvedAlreadyCaptured?.captureId ||
      (data as any).purchase_units?.[0]?.payments?.captures?.[0]?.id ||
      (data as any).id ||
      null;

    const { updated, order: updatedOrder } = await completeOrderPaymentCapture(
      serverOrderId,
      captureId
    );

    if (!updatedOrder) {
      await failIdempotencyKey(idempotencyKey, 'capture_payment').catch(() => {});
      return res.status(500).json({
        success: false,
        error: "Order not found after capture",
      });
    }

    if (!updated && updatedOrder.payment_status === 'completed') {
      const cachedResponse = {
        success: true,
        captureId: updatedOrder.paypal_capture_id,
        status: 'COMPLETED',
        serverOrderId,
        orderNumber: updatedOrder.order_number,
        cached: true,
      };
      await completeIdempotencyKey(idempotencyKey, 'capture_payment', cachedResponse, {
        serverOrderId,
        paypalOrderId,
      });
      return res.json(cachedResponse);
    }

    if (!updated || updatedOrder.payment_status !== 'completed') {
      await failIdempotencyKey(idempotencyKey, 'capture_payment').catch(() => {});
      logger.error('Capture succeeded at PayPal but order was not completed', {
        serverOrderId,
        payment_status: updatedOrder.payment_status,
        captureId,
      });
      return res.status(409).json({
        success: false,
        error: 'Order was not updated after payment capture',
        message: 'Payment may require manual reconciliation. Contact support with your order number.',
        payment_status: updatedOrder.payment_status,
      });
    }

    const items =
      typeof updatedOrder.items === 'string' ? JSON.parse(updatedOrder.items) : updatedOrder.items;
    const shippingAddress =
      typeof updatedOrder.shipping_address === 'string'
        ? JSON.parse(updatedOrder.shipping_address)
        : updatedOrder.shipping_address;

    const reservedCoupon = await getCouponForOrder(serverOrderId);
    if (reservedCoupon && couponId && couponId !== reservedCoupon.coupon_id) {
      logger.warn('Capture couponId does not match reserved coupon; using reservation', {
        serverOrderId,
      });
    }

    const orderRecord = updatedOrder as Record<string, unknown>;

    if (updated) {
      await sendPostCaptureNotifications(orderRecord, { accessToken: accessToken ?? undefined });
    }

    logger.info('Payment captured and order updated', { serverOrderId, captureId });

    const captureResponse = {
      success: true,
      captureId,
      status: data.status || 'COMPLETED',
      serverOrderId,
      orderNumber: updatedOrder.order_number,
      order: {
        id: updatedOrder.id,
        order_number: updatedOrder.order_number,
        customer_email: orderRecord.customer_email,
        customer_name: orderRecord.customer_name,
        total: parseFloat(updatedOrder.total?.toString() || '0'),
        status: updatedOrder.status,
        payment_status: updatedOrder.payment_status,
        items,
        shipping_address: shippingAddress,
      },
      payer: (data as any).payer,
    };

    await completeIdempotencyKey(idempotencyKey, 'capture_payment', captureResponse, {
      serverOrderId,
      paypalOrderId,
    });

    res.json(captureResponse);
  } catch (error: any) {
    logger.error("❌ Capture payment error:", error);

    const failedKey = buildCapturePaymentKey(
      req.headers['x-idempotency-key'] as string | undefined,
      req.params.orderId
    );
    await failIdempotencyKey(failedKey, 'capture_payment').catch(() => {});

    res.status(500).json({
      success: false,
      error: clientErrorMessage(error, 'Failed to capture payment'),
    });
  }
});

// Exchange one-time checkout code for order access token (PayPal return URL — no token in query string)
app.get("/api/paypal/checkout-exchange/:code", async (req: Request, res: Response) => {
  try {
    const { code } = req.params;
    if (!code?.trim()) {
      return res.status(400).json({ success: false, error: 'Exchange code is required' });
    }

    const result = await redeemCheckoutExchangeCode(code);
    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Invalid or expired checkout code',
        message: 'This payment link has expired. Check your email for order details or contact support.',
      });
    }

    const coupon = await getCouponForOrder(result.serverOrderId);

    res.json({
      success: true,
      accessToken: result.accessToken,
      serverOrderId: result.serverOrderId,
      orderNumber: result.orderNumber,
      paypalOrderId: result.paypalOrderId,
      total: result.total,
      couponId: coupon?.coupon_id,
      discount_amount: coupon?.discount_amount,
    });
  } catch (error: unknown) {
    logger.error('Checkout exchange error:', error);
    res.status(500).json({
      success: false,
      error: clientErrorMessage(error, 'Failed to exchange checkout code'),
    });
  }
});

// Recover checkout context after PayPal redirect (when localStorage is unavailable)
app.get("/api/paypal/checkout-context/:paypalOrderId", async (req: Request, res: Response) => {
  try {
    const { paypalOrderId } = req.params;
    const accessToken = getOrderAccessTokenFromRequest(req);

    if (!paypalOrderId) {
      return res.status(400).json({ success: false, error: 'PayPal order ID is required' });
    }

    if (!accessToken) {
      return res.status(401).json({
        success: false,
        error: 'Token required',
        message: 'Order access token is required',
      });
    }

    const rows = await sql`
      SELECT id, order_number, payment_status, total, paypal_order_id, access_token_hash
      FROM orders
      WHERE paypal_order_id = ${paypalOrderId}
      LIMIT 1
    `;

    if (!rows.length) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = rows[0];

    if (!orderAccessMatches(order.access_token_hash as string, accessToken)) {
      return res.status(403).json({ success: false, error: 'Invalid order access token' });
    }

    if (order.payment_status === 'completed') {
      return res.json({
        success: true,
        alreadyCompleted: true,
        serverOrderId: order.id,
        orderNumber: order.order_number,
      });
    }

    const coupon = await getCouponForOrder(order.id as string);

    res.json({
      success: true,
      serverOrderId: order.id,
      orderNumber: order.order_number,
      total: parseFloat(order.total?.toString() || '0'),
      paypalOrderId: order.paypal_order_id,
      couponId: coupon?.coupon_id,
      discount_amount: coupon?.discount_amount,
    });
  } catch (error: unknown) {
    logger.error('Checkout context error:', error);
    res.status(500).json({
      success: false,
      error: clientErrorMessage(error, 'Failed to load checkout context'),
    });
  }
});

// Get Order Details (admin only)
app.get("/api/paypal/order/:orderId", verifyAdmin, async (req: Request, res: Response) => {
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
    logger.error("Get order error:", error);
    res.status(500).json({
      success: false,
      error: clientErrorMessage(error, 'Failed to get order details'),
    });
  }
});

// Refund Payment — disabled (no-refund store policy; operational auto-refunds use paypalRefund.ts internally)
app.post("/api/paypal/refund/:captureId", verifyAdmin, async (_req: Request, res: Response) => {
  const { CUSTOMER_REFUND_DISABLED_MESSAGE } = await import('./lib/returnPolicy');
  res.status(403).json({
    success: false,
    error: 'Refunds not available',
    message: CUSTOMER_REFUND_DISABLED_MESSAGE,
  });
});

// API 404 — JSON only under /api
app.use('/api', (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.originalUrl,
  });
});

const frontendMounted = mountFrontend(app, isProduction);

if (!frontendMounted) {
  app.use((req: Request, res: Response) => {
    res.status(404).json({
      success: false,
      error: 'Route not found',
      path: req.path,
    });
  });
} else {
  app.use((req: Request, res: Response) => {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({
        success: false,
        error: 'Route not found',
        path: req.path,
      });
    }
    res.status(404).json({
      success: false,
      error: 'Route not found',
      path: req.path,
    });
  });
}

// Error handling middleware - MUST have 4 parameters
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  const path = getRequestPath(req);
  const durationMs = req.requestStartMs ? Date.now() - req.requestStartMs : undefined;
  const errCode = (err as NodeJS.ErrnoException).code;

  req.log?.error(
    {
      err,
      method: req.method,
      path,
      durationMs,
      code: errCode,
      headersSent: res.headersSent,
      pool: getPoolStats(),
    },
    'Unhandled server error'
  );

  captureException(err, {
    requestId: req.requestId,
    method: req.method,
    path,
  });

  if (res.headersSent) return;

  const isDev = process.env.NODE_ENV === 'development';
  res.status(500).json({
    success: false,
    error: isDev ? (err.message || 'Internal server error') : 'Internal server error',
    ...(isDev && { stack: err.stack }),
    ...(isDev && req.requestId ? { requestId: req.requestId } : {}),
  });
});

// Start server only when run directly (not when imported by tests)
export { app };

let server: ReturnType<typeof app.listen> | undefined;

if (require.main === module) {
  server = startHttpServer();
  registerGracefulShutdown(server);

  const blockApiUntilBootstrap =
    isProduction || process.env.BOOTSTRAP_BLOCK_API === 'true';

  if (!blockApiUntilBootstrap) {
    serverReady = true;
    logger.info('API ready — bootstrap continues in background (dev only)');
  }

  bootstrap()
    .then(() => {
      if (blockApiUntilBootstrap) {
        serverReady = true;
        logger.info('Bootstrap complete — API ready');
      } else {
        logger.info(
          'Core bootstrap complete — deferred RLS/cache tasks may still be running in background'
        );
      }
      startMaintenanceJobs();
    })
    .catch((err) => {
      logger.error('Startup failed:', err);
      if (blockApiUntilBootstrap) {
        process.exit(1);
      }
      logger.error('Bootstrap failed in dev — API stays up; fix DATABASE_URL or set BOOTSTRAP_SKIP_DDL=true');
    });
}

async function runDeferredBootstrap(): Promise<void> {
  try {
    logger.info('Deferred bootstrap started (skips steps already applied)');
    await runBootstrapTask('rls_policies', ensureRlsPolicies);
    await runBootstrapTask('purge_legacy_admin_sessions', purgeLegacyAdminSessions);
    await runBootstrapTask('warm_caches', warmCaches);
    logger.info('Deferred bootstrap complete');
  } catch (err) {
    logger.error('Deferred bootstrap failed (dev only, non-fatal):', err);
  }
}

async function bootstrap(): Promise<void> {
  logger.info('Bootstrap started');
  await pingDatabaseWithTimeout();
  logger.info('Bootstrap: database reachable');
  if (process.env.REDIS_URL?.trim()) {
    try {
      await connectRedis();
    } catch (err) {
      if (isProduction) {
        logger.error('Redis connection failed in production:', err);
        throw err;
      }
      logger.warn('Redis connection failed (cache/rate limits use fallback):', err);
    }
  }
  await runBootstrapTask('payment_idempotency', ensureIdempotencyTable);
  await runBootstrapTask('activity_logs', ensureActivityLogsTable);
  await runBootstrapTask('order_payment_schema', ensureOrderPaymentSchema);
  await runBootstrapTask('checkout_exchange', ensureCheckoutExchangeTable);
  await runBootstrapTask('order_access_exchange', ensureOrderAccessExchangeTable);

  const blockUntilRls =
    isProduction || process.env.BOOTSTRAP_BLOCK_UNTIL_RLS === 'true';

  if (blockUntilRls) {
    await runBootstrapTask('rls_policies', ensureRlsPolicies);
    await runBootstrapTask('purge_legacy_admin_sessions', purgeLegacyAdminSessions);
    await runBootstrapTask('warm_caches', warmCaches);
    return;
  }

  logger.info(
    'Bootstrap: core schema ready — API will accept traffic; RLS/cache work continues in background'
  );
  void runDeferredBootstrap();
}

function startHttpServer() {
  const PORT = Number(process.env.PORT) || 5000;
  const HTTPS_PORT = Number(process.env.HTTPS_PORT) || 443;
  const sslConfig = getSSLConfig();

  const listenHost = isProduction ? undefined : '0.0.0.0';

  if (sslConfig && isProduction) {
    const httpsServer = https.createServer(sslConfig, app).listen(HTTPS_PORT, () => {
      logServerBanner('HTTPS', HTTPS_PORT, true);
    });
    if (listenHost) {
      app.listen(PORT, listenHost, () => {
        logger.info(`HTTP port: ${PORT} (redirecting to HTTPS)`);
      });
    } else {
      app.listen(PORT, () => {
        logger.info(`HTTP port: ${PORT} (redirecting to HTTPS)`);
      });
    }
    return httpsServer;
  }

  const onListen = () => {
    logServerBanner('HTTP', PORT, false);
    if (!isProduction && listenHost === '0.0.0.0') {
      const lanIps = getLanIPv4Addresses();
      if (lanIps.length > 0) {
        for (const ip of lanIps) {
          logger.info(`LAN: backend reachable at http://${ip}:${PORT}`);
        }
      } else {
        const fallback = getPrimaryLanIPv4() ?? 'localhost';
        logger.info(`LAN: backend reachable at http://${fallback}:${PORT}`);
      }
    }
  };

  return listenHost ? app.listen(PORT, listenHost, onListen) : app.listen(PORT, onListen);
}

function logServerBanner(mode: string, port: number | string, sslEnabled: boolean) {
  const title = sslEnabled ? 'HTTPS server running' : 'Server running successfully';
  logger.info(title);
  logger.info(`${mode} port: ${port}`);
  if (isProduction && !sslEnabled && mode === 'HTTP') {
    logger.info('WARNING: Running in production without SSL');
  }
  logger.info(`Frontend: ${process.env.FRONTEND_URL || 'http://localhost:5173'}`);
  logger.info(`PayPal mode: ${process.env.PAYPAL_MODE || 'sandbox'}`);
  logger.info(`PayPal API: ${PAYPAL_API}`);
  logger.info(`Started: ${new Date().toLocaleString()}`);
}

