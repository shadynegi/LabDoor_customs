# Security Controls Reference

Security implementation overview for Lab Door Customs.

**Full reference:** [`info.md`](info.md) — see Security and Logging sections


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** → processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. 
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_form_submit` on contact success. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Authentication

- Admin: bcrypt password hash, HTTP-only session cookie, SHA-256 session hash in `admin_sessions`, 24h TTL
- Customer orders: access token (SHA-256 hash stored); checkout exchange codes for PayPal redirect URLs

## Request protection

- CSRF double-submit on mutating routes (exempt: PayPal webhook, `POST /api/activity/batch`)
- Helmet security headers, CSP for PayPal domains
- Rate limiting on login, contact, checkout (Redis-backed in production)
- HTTPS enforced in production via Cloudflare `x-forwarded-proto`

## Database access

- Supabase PostgreSQL via Express `service_role` only; RLS on 13 tables with no anon/authenticated PostgREST access
- Order access tokens SHA-256 hashed; checkout exchange tokens AES-256-GCM encrypted (`ORDER_TOKEN_ENCRYPTION_KEY`)

## Payment security

- Server-side pricing only — client totals validated at checkout and on cart changes via `POST /api/products/validate-cart`
- PayPal webhook signature verification on raw body
- Webhook capture amount resolved from PayPal API when missing from payload
- Capture amount mismatch triggers auto-refund
- Idempotency keys prevent duplicate orders and refunds (separate keys for create vs capture)

## Data protection

- Secrets stripped from API responses (access tokens, password hashes)
- Review PII: `toPublicReview()` on public routes; `POST /api/reviews/check` (email in body)
- Order tracking: one-time `order_access_exchanges` codes in email links (no token in URL)
- `schema.sql` uses service_role-only RLS; `ensureRlsPolicies()` fails on Supabase unless `ALLOW_INSECURE_RLS=true`
- Manual mark paid: PayPal capture verified via API before DB update
- Paid orders cannot cancel without refund
- Webhook/refund errors sanitized (no internal messages to clients)
- Parameterized SQL via postgres.js
- Admin routes require session middleware
- Product image uploads capped at 512KB for data URLs
- Supabase RLS: service role for writes; applied at backend startup

## Production gates

- `backend/scripts/validate-env.mjs` + startup validation + CI step
- Redis required for healthy status and startup in production
- `POST /api/admin/generate-hash` disabled in production
