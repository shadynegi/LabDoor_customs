# Project Status — Current Capabilities

**Authoritative reference:** [`info.md`](info.md)

This document describes what the Lab Door Customs platform currently supports.

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on **14** sensitive tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** shows processing UI (polls checkout-context; cart held); checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Products paginated (load more); messages mark read on open; coupons support scope; reviews admin response; estimated delivery on orders; tab error/retry states. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation success copy; vote error toasts; admin `admin_response` editable. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Storefront

- Product catalog with filters, pagination, and Fuse.js search
- Product detail pages with 360° viewer (real video assets or spin placeholder), reviews, and structured data
- Shopping cart (localStorage) with server price validation on each change and **retry** on validation failure
- PayPal checkout with server-side pricing and coupon validation
- Payment success page: redeems checkout exchange `?code=`, captures payment; handles **409** reconciliation UI; surfaces expired exchange errors; strips sensitive params from URL on success
- Customer order lookup at `/orders` via `POST /api/orders/lookup`
- Contact form, policy pages, cookie consent, GA4 and activity tracking (consent-gated)
- Mobile sticky CTAs, checkout keyboard offset, responsive layouts — see [MOBILE_RESPONSIVE.md](./MOBILE_RESPONSIVE.md)

---

## Payments

- PayPal create-payment with atomic order + stock reservation; returns `serverOrderId` and approval links (access token via checkout exchange only)
- One-time checkout exchange codes in PayPal return URL (`?code=`); tokens encrypted at rest; atomic single-use redeem
- PayPal capture with access token, amount validation, idempotency, and 409 when capture succeeds but DB order is not completed
- PayPal webhooks (capture completed/denied, refund/reversal) with signature verification, amount fallback, and 500 on reconciliation failure
- **No-refund store policy** — checkout requires `policy_accepted: true`; admin refund/cancel of paid orders returns **403**
- Operational auto-refund on capture amount mismatch; webhook refund/reversal sync for chargebacks
- Cumulative `refunded_amount` tracking with inventory restore on full operational refund
- Abandoned pending order cleanup (configurable TTL)
- Payment idempotency for create and capture operations

---

## Admin

- Secure login with HttpOnly session cookie (SHA-256 hashed server-side)
- Dashboard: analytics, products, orders, coupons, messages, customers, **reviews**
- Orders: server-side search, pagination, fulfillment modal, bulk status (max 500 IDs, validated transitions), manual mark paid (`admin_note` + `payment_id`, logged to activity)
- Coupons: presets, custom create with **applies_to** scope, edit modal, activate/deactivate, delete
- Products: paginated admin list (50/page, load more), error/retry UI
- Product CRUD and bulk stock updates
- Contact message inbox (mark read on open, modal reply/archive actions)
- Customer soft delete/restore and order history modal
- **Reviews tab**: moderation UI with customer email (admin-only), admin response field, quick approve/reject, pagination; storefront eligibility check + pending copy; public API strips email via `toPublicReview()`

---

## Infrastructure

- **Monorepo** — npm workspaces (`frontend`, `backend`); root `npm run dev|build|start|test`
- **Single-server** — Express serves `/api/*` and `frontend/dist` on one Railway service
- Redis required in production (cache + rate limits; fail closed when unavailable)
- Pino structured logging with request IDs — `Request started` / `Request finished`, slow-request warnings, DB retry labels, maintenance step timing
- Sentry required in production (backend + frontend build)
- Health endpoint (`/api/health`) with DB, Redis (503 if required but down), and PayPal status
- Maintenance jobs: idempotency cleanup (batched), stale order expiry, stuck key reaper (`SKIP LOCKED`), checkout/access exchange cleanup; deferred initial run
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

- 150 automated tests (81 backend unit + 41 API + 28 Playwright UI)
- Playwright storefront smoke tests (home, products, checkout, contact)
- Documentation link checker in CI
