# Capability Reference

Current Lab Door Customs platform version and feature set.

**Authoritative reference:** [`../info.md`](../info.md)

---

## Platform version

| Component | Stack |
|-----------|-------|
| Frontend | React 19, Vite 7, React Router 7 |
| Backend | Express 4, TypeScript, Node 20 |
| Database | Supabase PostgreSQL |
| Payments | PayPal Checkout (sandbox/live) |
| Cache | Redis 6 |
| Email | Resend |
| Monitoring | Pino + Sentry |

---

## Feature set

### Commerce

- Product catalog with search, filters, pagination
- Shopping cart (localStorage)
- PayPal checkout with server-bound orders
- Coupon validation with product/category scope
- Product reviews with moderation
- Free shipping over $200; $25 otherwise

### Payments

- Atomic order creation + stock reservation
- PayPal capture with amount validation
- Webhook processing with signature verification
- Admin refunds with balance validation
- Refund deduplication and cumulative tracking
- Payment idempotency for create and capture

### Admin

- Dashboard: analytics, products, orders, messages, customers
- Order cancel with PayPal refund sync
- Shipping notifications
- Bulk product/order/message updates

### Security

- CSRF protection with token refresh retry
- Admin HttpOnly session cookies
- Order access tokens (hashed)
- Rate limits (Redis-backed)
- Cloudflare proxy enforcement
- Production env validation

### Operations

- Structured logging (Pino) with request IDs
- Sentry error tracking (required in production)
- Redis cache with warming
- Maintenance jobs (order expiry, idempotency cleanup)
- Health endpoint
- CI with Vitest, Playwright, sitemap gate

### SEO

- Build-time sitemap with live product URLs
- robots.txt, meta tags, JSON-LD
- GA4 (consent-gated), Search Console verification

---

## Test coverage

- 45 backend Vitest tests
- 4 Playwright E2E smoke tests
- Documentation link checker

---

## Documentation

All guides indexed at [DOCUMENTATION_INDEX.md](./DOCUMENTATION_INDEX.md).
