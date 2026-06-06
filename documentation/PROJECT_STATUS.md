# Project Status — Current Capabilities

**Authoritative reference:** [`info.md`](info.md)

This document describes what the Lab Door Customs platform currently supports.

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; PayPal checkout exchange `?code=`; order tracking links use `GET /api/orders/access-exchange/:code` (no token in email URL); capture requires `serverOrderId` + `accessToken`. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel without refund; product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Storefront

- Product catalog with filters, pagination, and Fuse.js search
- Product detail pages with 360° viewer (real video assets or spin placeholder), reviews, and structured data
- Shopping cart (localStorage) with server price validation on each change
- PayPal checkout with server-side pricing and coupon validation
- Payment success page: redeems checkout exchange `?code=`, captures payment, strips sensitive params from URL
- Customer order lookup at `/orders` via `POST /api/orders/lookup`
- Contact form, policy pages, cookie consent, GA4 and activity tracking (consent-gated)
- Mobile sticky CTAs, checkout keyboard offset, responsive layouts — see [MOBILE_RESPONSIVE.md](./MOBILE_RESPONSIVE.md)

---

## Payments

- PayPal create-payment with atomic order + stock reservation; returns `serverOrderId` and approval links (access token via checkout exchange only)
- One-time checkout exchange codes in PayPal return URL (`?code=`); tokens encrypted at rest; atomic single-use redeem
- PayPal capture with access token, amount validation, idempotency, and 409 when capture succeeds but DB order is not completed
- PayPal webhooks (capture completed/denied, refund/reversal) with signature verification, amount fallback, and 500 on reconciliation failure
- Admin refunds with remaining-balance validation and deduplication
- Admin cancel with PayPal refund and full DB sync
- Cumulative `refunded_amount` tracking with inventory restore on full refund
- Abandoned pending order cleanup (configurable TTL)
- Payment idempotency for create and capture operations

---

## Admin

- Secure login with HttpOnly session cookie (SHA-256 hashed server-side)
- Dashboard: analytics, products, orders, coupons, messages, customers, **reviews**
- Orders: server-side search, pagination, fulfillment modal, bulk status (max 500 IDs, validated transitions), manual mark paid (`admin_note` + `payment_id`, logged to activity)
- Coupons: presets, custom create, edit modal, activate/deactivate, delete
- Product CRUD and bulk stock updates
- Contact message inbox
- Customer soft delete/restore and order history modal
- **Reviews tab**: moderation UI with customer email (admin-only), quick approve/reject, pagination; public API strips email via `toPublicReview()`

---

## Infrastructure

- **Monorepo** — npm workspaces (`frontend`, `backend`); root `npm run dev|build|start|test`
- **Single-server** — Express serves `/api/*` and `frontend/dist` on one Railway service
- Redis required in production (cache + rate limits; fail closed when unavailable)
- Pino structured logging with request IDs
- Sentry required in production (backend + frontend build)
- Health endpoint (`/api/health`) with DB, Redis (503 if required but down), and PayPal status
- Maintenance jobs: idempotency cleanup, stale order expiry, stuck key reaper, checkout exchange cleanup
- CI: backend validate-env + tests, frontend build with env validation, E2E smoke, sitemap gate

---

## Security

- CSRF double-submit with frontend retry on 403
- Rate limiting (Redis-backed in production)
- Cloudflare proxy enforcement in production
- Helmet CSP/HSTS, CORS whitelist, request timeouts
- Order access tokens (hashed at rest); checkout exchange for PayPal redirect
- Admin session tokens stored as SHA-256 hashes
- JWT complexity validation; production PayPal live mode gate
- Production environment validation at startup and build time
- PayPal ID uniqueness constraints

---

## SEO

- Build-time sitemap and robots.txt with live product URLs
- Meta tags, canonical URLs, JSON-LD on products
- Google Search Console verification support

---

## Testing

- 76 backend Vitest tests (unit + API)
- Playwright storefront smoke tests (home, products, checkout, contact)
- Documentation link checker in CI
