# Security Controls Reference

Security implementation overview for Lab Door Customs.

**Full reference:** [`info.md`](info.md) — Security, Logging, and Maintenance sections  
**Audit backlog:** [`PROJECT_AUDIT.md`](PROJECT_AUDIT.md) · **Test map:** [`COVERAGE_MATRIX.md`](COVERAGE_MATRIX.md)

---

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on **14** tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required (no-refund policy); DB-backed coupon validate; client/server total compare before PayPal; `?code=` exchange; capture **409** → processing UI with poll timeout; `checkout_complete` before redirect. |
| **Orders** | `access_token_encrypted` for durable email links; `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; uniform **404** on lookup; partial refresh keeps stale data + warning. |
| **Admin** | Server product search; products paginated (load more); messages mark read on open; coupons scope on create **and edit**; reviews admin response; estimated delivery; error/retry states; **no customer refunds** (cancel unpaid pending only). |
| **Activity** | Consent-gated batch (`inserted`/`skipped` counts); `contact_submit`, `purchase_complete`, `size_select`, `quantity_change` wired. |
| **Reviews** | `POST /api/reviews/check` on email blur (generic message, no product enumeration); pending-moderation copy; vote error toasts. |
| **Maintenance** | Ping-first scheduled jobs; transient pool errors (`CONNECT_TIMEOUT`, `ENOTFOUND`) skip with one log line — not a wrong `DATABASE_URL` if bootstrap succeeded. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

**Automated tests:** 153 (81 backend unit + 43 API + 29 Playwright) — see [`test_guidelines.md`](test_guidelines.md).

---

## Authentication

- Admin: bcrypt password hash, HTTP-only session cookie, SHA-256 session hash in `admin_sessions`, 24h TTL
- Customer orders: 64-char access token (SHA-256 hash + AES-256-GCM `access_token_encrypted` on order row); checkout exchange codes for PayPal return URLs; email links use one-time `order_access_exchanges` codes

## Request protection

- CSRF double-submit on mutating routes (exempt: PayPal webhook, `POST /api/activity/batch`)
- Helmet security headers, CSP for PayPal domains
- Rate limiting on login, contact, checkout (Redis-backed in production; fail closed)
- HTTPS enforced in production via Cloudflare `x-forwarded-proto`

## Database access

- Supabase PostgreSQL via Express `service_role` only; RLS on **14** tables with no anon/authenticated PostgREST access
- `ensureClientGrantsRevoked()` always runs (even when `BOOTSTRAP_SKIP_DDL=true`); production startup **fails** if client grants remain
- Order access tokens SHA-256 hashed; checkout exchange tokens and `access_token_encrypted` use AES-256-GCM (`ORDER_TOKEN_ENCRYPTION_KEY`)

## Payment security

- Server-side pricing only — `computeCheckoutPricingForCart` shared by create-payment and coupon validate; client totals compared before PayPal redirect (> $0.01 tolerance)
- Cart re-validated via `POST /api/products/validate-cart` on changes
- PayPal webhook signature verification on raw body
- Webhook capture amount resolved from PayPal API when missing from payload
- Capture amount mismatch triggers auto-refund
- Idempotency keys prevent duplicate orders and captures (separate keys for create vs capture)
- Webhook `PAYMENT.CAPTURE.DENIED` returns **500** when order binding cannot be resolved (PayPal retry)

## Data protection

- Secrets stripped from API responses (access tokens, password hashes)
- Review PII: `toPublicReview()` on public routes; `POST /api/reviews/check` (email in body, generic eligibility)
- Order tracking: one-time `order_access_exchanges` codes in email links (no long-lived token in URL)
- `schema.sql` + boot migrations apply service_role-only RLS; `ensureRlsPolicies()` non-destructive when policies exist
- Manual mark paid: PayPal capture verified via API before DB update
- Paid orders cannot be cancelled or refunded (no-refund store policy; replacements for manufacturing defects only)
- Order API responses strip `access_token_hash` and `access_token_encrypted` (`stripOrderSecrets`)
- Webhook/refund errors sanitized (no internal messages to clients)
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
| Low (tests) | Full create-payment happy path; email portal URL unit test |
| Low | Admin dashboard Playwright smoke; RLS grant-revoke DB integration test |
| Future | PayPal dispute webhooks, OpenAPI spec, Sentry release maps (see `CRITICAL_FIXES_TODO.md`) |
