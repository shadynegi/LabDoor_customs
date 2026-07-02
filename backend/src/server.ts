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
  getPoolStats,
  runBootstrapTask,
  pingDatabaseWithTimeout,
} from './lib/db';
import { getLanIPv4Addresses, getPrimaryLanIPv4 } from './lib/lanAddress';
import { csrfTokenSetter, csrfProtection, getCsrfTokenHandler } from './middleware/csrf';
import { requireCloudflareProxy } from './middleware/cloudflare';
import { getClientIp } from './lib/clientIp';
import { logger } from './lib/logger';
import { initSentry, captureException } from './lib/sentry';
import { requestIdMiddleware } from './middleware/requestId';
import { requestLogMiddleware } from './middleware/requestLog';
import { getRequestPath, getRequestTimeoutMs } from './lib/requestTiming';
import { mountRateLimits } from './middleware/rateLimits';
import { startMaintenanceJobs } from './lib/maintenanceJobs';
import { ensureActivityLogsTable } from './lib/activitySchema';
import { ensureProductVideo360Column, ensureAdminEnhancementSchema, ensureProductPublicIdColumn } from './lib/productSchema';
import { registerGracefulShutdown } from './lib/gracefulShutdown';
import { ensureIdempotencyTable } from './lib/paymentIdempotency';
import { warmCaches } from './lib/cacheWarm';
import { connectRedis, isRedisEnabled, getRedisClient } from './lib/redis';
import { ensureOrderAccessExchangeTable } from './lib/orderAccessExchange';
import { ensureOrderPaymentSchema } from './lib/orderSchemaMigrations';
import { ensureRlsPolicies } from './lib/rlsMigration';
import { assertJwtSecretForProduction } from './lib/jwtSecret';
import { purgeLegacyAdminSessions } from './lib/adminSessionMigration';
import { mountFrontend } from './lib/serveFrontend';
import { registerProcessErrorHandlers } from './lib/processErrorHandlers';
import { ensureUploadDirs, getUploadRoot } from './lib/productUpload';

// Import routes
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import contactRouter from "./routes/contact";
import adminRouter, { verifyAdmin } from "./routes/admin";
import activityRouter from "./routes/activity";
import reviewsRouter from "./routes/reviews";
import couponsRouter from "./routes/coupons";
import checkoutRouter from "./routes/checkout";

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
    'REDIS_URL',
    'SENTRY_DSN',
    'RESEND_API_KEY',
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

    if (process.env.ALLOW_INSECURE_RLS === 'true') {
      logger.error('ALLOW_INSECURE_RLS=true is forbidden in production');
      process.exit(1);
    }

    const minSecretLen = 32;
    for (const key of ['ORDER_TOKEN_ENCRYPTION_KEY', 'IP_SALT'] as const) {
      const value = process.env[key]?.trim() || '';
      if (value.length < minSecretLen) {
        logger.error(`${key} must be at least ${minSecretLen} characters in production`);
        process.exit(1);
      }
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
ensureUploadDirs();

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
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", frontendOrigin],
      frameSrc: ["'self'"],
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
    const isPrivateLan =
      /^192\.168\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(hostname) ||
      /^172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}$/.test(hostname);

    // LAN devices — any port (Vite uses 5174+ when 5173 is busy).
    if (isPrivateLan) return true;

    const devPorts = new Set(['5173', '5174', '5175', '3000', '4173', '']);
    if (!devPorts.has(port)) return false;
    return hostname === 'localhost' || hostname === '127.0.0.1';
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

app.use(express.json({ limit: '1mb' }));
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

// API Routes
app.use(
  '/uploads',
  express.static(getUploadRoot(), {
    index: false,
    maxAge: isProduction ? '7d' : 0,
  })
);
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/contact", contactRouter);
app.use("/api/admin", adminRouter);
app.use("/api/activity", activityRouter);
app.use("/api/reviews", reviewsRouter);
app.use("/api/coupons", couponsRouter);
app.use("/api/checkout", checkoutRouter);

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
  await runBootstrapTask('product_video_360', ensureProductVideo360Column);
  await runBootstrapTask('product_public_id', ensureProductPublicIdColumn);
  await runBootstrapTask('admin_enhancements', ensureAdminEnhancementSchema);
  await runBootstrapTask('order_line_items_backfill', async () => {
    const { backfillOrderLineItems } = await import('./lib/orderLineItems');
    await backfillOrderLineItems(200);
  });
  await runBootstrapTask('order_payment_schema', ensureOrderPaymentSchema);
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
  logger.info(`Started: ${new Date().toLocaleString()}`);
}

