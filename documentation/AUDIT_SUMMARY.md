# Security Controls Reference

Security implementation overview for Lab Door Customs.

**Full reference:** [`info.md`](info.md) — Security, Logging, and Maintenance sections  
**Audit backlog:** [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) · **Test map:** [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md)

---

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on **14** tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required (no-refund policy); DB-backed coupon validate; client/server total compare before place-order; WhatsApp redirect; `checkout_complete` before redirect. |
| **Orders** | Email links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); tracked orders in sessionStorage; legacy access-exchange returns **410**; lookup failure message **Order not found**. |
| **Admin** | Server product search; products paginated (load more); coupons scope on create **and edit**; reviews admin response; estimated delivery; error/retry states; **Settings** tab (activity export, sessions, customer recompute); **no customer refunds** (cancel unpaid pending only). |
| **Activity** | Consent-gated batch (`inserted`/`skipped` counts); `contact_submit`, `purchase_complete`, `size_select`, `quantity_change` wired. |
| **Reviews** | `POST /api/reviews/check` on email blur (generic message, no product enumeration); pending-moderation copy; vote error toasts. |
| **Maintenance** | Ping-first scheduled jobs; transient pool errors (`CONNECT_TIMEOUT`, `ENOTFOUND`) skip with one log line — not a wrong `DATABASE_URL` if bootstrap succeeded. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

**Automated tests:** 409 (120 backend unit + 74 API + 215 Playwright) — see [`test_guidelines.md`](test_guidelines.md).

---

## Authentication

- Admin: bcrypt password hash, HTTP-only session cookie, SHA-256 session hash in `admin_sessions`, 24h TTL
- Customer orders: lookup by order ID (UUID) + checkout email; email links pre-fill `?orderId=` on `/orders`; legacy `GET /api/orders/access-exchange/:code` returns **410**

## Request protection

- CSRF double-submit on mutating routes (exempt: `POST /api/activity/batch`)
- Helmet security headers and CSP
- Rate limiting on login, contact, checkout (Redis-backed in production; fail closed)
- HTTPS enforced in production via Cloudflare `x-forwarded-proto`

## Database access

- Supabase PostgreSQL via Express `service_role` only; RLS on **14** tables with no anon/authenticated PostgREST access
- `ensureClientGrantsRevoked()` always runs (even when `BOOTSTRAP_SKIP_DDL=true`); production startup **fails** if client grants remain
- Order access tokens SHA-256 hashed; `access_token_encrypted` uses AES-256-GCM (`ORDER_TOKEN_ENCRYPTION_KEY`)

## Checkout security

- Server-side pricing only — `computeCheckoutPricingForCart` shared by place-order and coupon validate; client totals compared before place-order (> $0.01 tolerance)
- Cart re-validated via `POST /api/products/validate-cart` on changes
- Idempotency keys prevent duplicate place-order submissions
- Pending orders expire via maintenance when abandoned

## Data protection

- Secrets stripped from API responses (access tokens, password hashes)
- Review PII: `toPublicReview()` on public routes; `POST /api/reviews/check` (email in body, generic eligibility)
- Order tracking: one-time `order_access_exchanges` codes in email links (no long-lived token in URL)
- `schema.sql` + boot migrations apply service_role-only RLS; `ensureRlsPolicies()` non-destructive when policies exist
- Manual mark paid: admin note + external payment reference required; logged to activity
- Paid orders cannot be cancelled or refunded (no-refund store policy; replacements for manufacturing defects only)
- Order API responses strip `access_token_hash` and `access_token_encrypted` (`stripOrderSecrets`)
- Parameterized SQL via postgres.js
- Admin routes require session middleware
- Product image uploads via Multer (`POST /api/admin/uploads/product-media`); stored files served at `/uploads/products/*`
- Supabase RLS: service role for writes; applied at backend startup

## Production gates

- `backend/scripts/validate-env.mjs` + startup validation + CI step
- Redis required for healthy status and startup in production
- `POST /api/admin/generate-hash` disabled in production

---

## Remaining low-priority gaps

Track in [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) and [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md):

| Priority | Gap |
|----------|-----|
| Low | RLS grant-revoke live DB integration test (unit mock coverage exists) |
| Future | OpenAPI spec, Sentry release maps, true load testing (k6/Artillery) — see `CRITICAL_FIXES_TODO.md` |
