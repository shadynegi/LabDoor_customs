import rateLimit, { type Store } from 'express-rate-limit';
import type { Express, Request, Response } from 'express';
import { getClientIp } from '../lib/clientIp';
import { createHybridRateLimitStore } from '../lib/rateLimitStore';

const rateLimitKey = (req: Request) => getClientIp(req);

const rateLimit429 = (error: string) => (_req: Request, res: Response) => {
  res.status(429).json({
    success: false,
    error,
    retryAfter: res.getHeader('Retry-After'),
  });
};

const isPayPalWebhookRequest = (req: Request) =>
  req.method === 'POST' &&
  (req.path === '/webhook' ||
    req.path === '/api/paypal/webhook' ||
    req.originalUrl.startsWith('/api/paypal/webhook'));

let mounted = false;

export function mountRateLimits(app: Express): void {
  if (mounted) return;
  mounted = true;

  const useRedis = Boolean(process.env.REDIS_URL?.trim());
  const storeFor = (prefix: string): Store | undefined =>
    useRedis ? createHybridRateLimitStore(prefix) : undefined;

  const common = {
    standardHeaders: true as const,
    legacyHeaders: false,
    keyGenerator: rateLimitKey,
  };

  app.use(
    '/api/',
    rateLimit({
      ...common,
      store: storeFor('rl:api'),
      windowMs: 15 * 60 * 1000,
      max: 300,
      handler: rateLimit429('Too many requests, please try again later.'),
      skip: (req) => req.path === '/api/health' || isPayPalWebhookRequest(req),
    })
  );

  app.use(
    '/api/admin/login',
    rateLimit({
      ...common,
      store: storeFor('rl:auth'),
      windowMs: 15 * 60 * 1000,
      max: 5,
      skipSuccessfulRequests: true,
      handler: rateLimit429('Too many login attempts. Please try again in 15 minutes.'),
    })
  );

  app.use(
    '/api/paypal',
    rateLimit({
      ...common,
      store: storeFor('rl:paypal'),
      windowMs: 15 * 60 * 1000,
      max: 30,
      skip: isPayPalWebhookRequest,
      handler: rateLimit429('Too many payment attempts, please try again later.'),
    })
  );

  app.use(
    '/api/contact',
    rateLimit({
      ...common,
      store: storeFor('rl:contact'),
      windowMs: 60 * 60 * 1000,
      max: 5,
      handler: rateLimit429('Too many messages sent, please try again later.'),
    })
  );

  app.post(
    '/api/orders',
    rateLimit({
      ...common,
      store: storeFor('rl:orders'),
      windowMs: 60 * 60 * 1000,
      max: 30,
      handler: rateLimit429('Too many orders, please try again later.'),
    })
  );

  app.post(
    '/api/reviews/admin',
    rateLimit({
      ...common,
      store: storeFor('rl:reviews-admin'),
      windowMs: 15 * 60 * 1000,
      max: 30,
      handler: rateLimit429('Too many review requests. Please try again later.'),
    })
  );

  app.post(
    '/api/reviews',
    rateLimit({
      ...common,
      store: storeFor('rl:reviews'),
      windowMs: 60 * 60 * 1000,
      max: 5,
      handler: rateLimit429('Too many reviews submitted. Please try again later.'),
    })
  );

  app.post(
    '/api/coupons/validate',
    rateLimit({
      ...common,
      store: storeFor('rl:coupons'),
      windowMs: 15 * 60 * 1000,
      max: 20,
      handler: rateLimit429('Too many coupon attempts. Please try again later.'),
    })
  );

  app.post(
    '/api/activity/log',
    rateLimit({
      ...common,
      store: storeFor('rl:activity-log'),
      windowMs: 15 * 60 * 1000,
      max: 120,
      handler: rateLimit429('Too many activity requests. Please try again later.'),
    })
  );

  app.post(
    '/api/activity/batch',
    rateLimit({
      ...common,
      store: storeFor('rl:activity-batch'),
      windowMs: 15 * 60 * 1000,
      max: 120,
      handler: rateLimit429('Too many activity requests. Please try again later.'),
    })
  );

  app.post(
    '/api/reviews/:id/vote',
    rateLimit({
      ...common,
      store: storeFor('rl:review-vote'),
      windowMs: 15 * 60 * 1000,
      max: 30,
      handler: rateLimit429('Too many review votes. Please try again later.'),
    })
  );

  app.post(
    '/api/orders/lookup',
    rateLimit({
      ...common,
      store: storeFor('rl:order-lookup'),
      windowMs: 15 * 60 * 1000,
      max: 20,
      handler: rateLimit429('Too many order lookup attempts. Please try again later.'),
    })
  );

  app.post(
    '/api/products/search',
    rateLimit({
      ...common,
      store: storeFor('rl:product-search'),
      windowMs: 15 * 60 * 1000,
      max: 60,
      handler: rateLimit429('Too many search requests. Please try again later.'),
    })
  );

  app.get(
    '/api/paypal/checkout-exchange/:code',
    rateLimit({
      ...common,
      store: storeFor('rl:checkout-exchange'),
      windowMs: 15 * 60 * 1000,
      max: 30,
      handler: rateLimit429('Too many checkout exchange attempts. Please try again later.'),
    })
  );

  app.post(
    '/api/reviews/check',
    rateLimit({
      ...common,
      store: storeFor('rl:review-check'),
      windowMs: 15 * 60 * 1000,
      max: 20,
      handler: rateLimit429('Too many eligibility checks. Please try again later.'),
    })
  );

  app.get(
    '/api/orders/access-exchange/:code',
    rateLimit({
      ...common,
      store: storeFor('rl:order-access-exchange'),
      windowMs: 15 * 60 * 1000,
      max: 30,
      handler: rateLimit429('Too many tracking link attempts. Please try again later.'),
    })
  );
}

/** Reset for tests only. */
export function resetRateLimitsForTests(): void {
  mounted = false;
}
