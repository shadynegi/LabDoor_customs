# Project Status — Current Capabilities

**Authoritative reference:** [`../info.md`](../info.md)

This document describes what the Lab Door Customs platform currently supports.

---

## Storefront

- Product catalog with filters, pagination, and Fuse.js search
- Product detail pages with 360° viewer, reviews, and structured data
- Shopping cart (localStorage)
- PayPal checkout with server-side pricing and coupon validation
- Payment success/cancel pages with checkout recovery via access token
- Customer order lookup by order number + access token
- Contact form, policy pages, cookie consent, GA4 (consent-gated)

---

## Payments

- PayPal create-payment with atomic order + stock reservation
- PayPal capture with access token, amount validation, and idempotency
- PayPal webhooks (capture completed/denied, refund/reversal) with signature verification
- Admin refunds with remaining-balance validation and deduplication
- Admin cancel with PayPal refund and full DB sync
- Cumulative `refunded_amount` tracking with inventory restore on full refund
- Abandoned pending order cleanup (configurable TTL)
- Payment idempotency for create and capture operations

---

## Admin

- Secure login with HttpOnly session cookie
- Dashboard: analytics, products, orders, messages, customers
- Order lifecycle: status, tracking, cancel, refund, ship notification
- Product CRUD and bulk stock updates
- Contact message inbox
- Coupon and review management via API

---

## Infrastructure

- Redis required in production (cache + rate limits)
- Pino structured logging with request IDs
- Sentry required in production (backend + frontend build)
- Health endpoint with DB, Redis, and PayPal status
- Maintenance jobs: idempotency cleanup, stale order expiry, stuck key reaper
- CI: backend tests, frontend build with env validation, E2E smoke, sitemap gate

---

## Security

- CSRF double-submit with frontend retry on 403
- Rate limiting (Redis-backed)
- Cloudflare proxy enforcement in production
- Helmet CSP/HSTS, CORS whitelist, request timeouts
- Order access tokens, admin session validation
- Production environment validation at startup and build time
- PayPal ID uniqueness constraints

---

## SEO

- Build-time sitemap and robots.txt with live product URLs
- Meta tags, canonical URLs, JSON-LD on products
- Google Search Console verification support

---

## Testing

- 45 backend Vitest tests
- Playwright storefront smoke tests (home, products, checkout, contact)
- Documentation link checker in CI
