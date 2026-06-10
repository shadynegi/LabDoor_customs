# Lab Door Customs — Project Reference

**Lab Door Customs** is a full-stack e-commerce application for custom footwear. A React storefront handles browsing, cart, and PayPal checkout; an Express API owns pricing, inventory, orders, admin operations, and PayPal webhooks. PostgreSQL (Supabase) is the system of record.

**Documentation hub:** [`DOCUMENTATION_INDEX.md`](DOCUMENTATION_INDEX.md)

**Doc maintenance:** When changing behavior, update this file and the relevant guides in this folder (see [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)). Agents follow [`.cursor/rules/documentation-sync.mdc`](../.cursor/rules/documentation-sync.mdc).

---

## Table of contents

1. [Architecture](#architecture)
2. [Tech stack](#tech-stack)
3. [Storefront features](#storefront-features)
4. [Admin dashboard](#admin-dashboard)
5. [Checkout and payments](#checkout-and-payments)
6. [Orders and customers](#orders-and-customers)
7. [Coupons and pricing](#coupons-and-pricing)
8. [Reviews and contact](#reviews-and-contact)
9. [Activity and analytics](#activity-and-analytics)
10. [Security](#security)
11. [Logging and monitoring](#logging-and-monitoring)
12. [Server startup and bootstrap](#server-startup-and-bootstrap)
13. [Caching and Redis](#caching-and-redis)
14. [Email](#email)
15. [Maintenance jobs](#maintenance-jobs)
16. [SEO and sitemap](#seo-and-sitemap)
17. [Database](#database)
18. [Complete API endpoints](#complete-api-endpoints)
19. [Webpage URLs](#webpage-urls)
20. [Environment variables](#environment-variables)
21. [CI/CD and deployment](#cicd-and-deployment)
22. [Local development](#local-development)
23. [Testing](#testing)

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Single Express server (production)                          │
│  • /api/*  → REST API                                        │
│  • /*      → React SPA (frontend/dist) + client-side routes  │
└────────┬───────────────────────────────────────┬────────────┘
         │ PayPal redirect                       │ postgres.js
         ▼                                       ▼
┌─────────────────┐                     ┌──────────────────┐
│  PayPal         │ ─── webhooks ──────►│  Supabase        │
│  Checkout       │                     │  PostgreSQL      │
└─────────────────┘                     └────────┬─────────┘
                                                 │
         ┌───────────────────────────────────────┤
         ▼                                       ▼
┌─────────────────┐                     ┌──────────────────┐
│  Redis          │                     │  Resend (email)  │
│  cache + limits │                     │  Sentry (errors) │
└─────────────────┘                     └──────────────────┘
```

**Monorepo layout**

| Path | Role |
|------|------|
| `package.json` | Root workspace — `npm run dev`, `build`, `start`, `test` |
| `frontend/` | React 19 SPA — Vite build output consumed by Express |
| `backend/` | Express server — API, static SPA hosting, PayPal, jobs, cache |
| `Tests/` | Vitest + Playwright |
| `.github/workflows/` | CI, Supabase keep-alive cron |
| `` | Setup, deploy, and operational guides |
| `scripts/` | Root link checker, doc sync utilities |

**Local development** runs the Vite dev server (port 5173) and API (port 5000) in parallel via `npm run dev` from the repo root. Vite proxies `/api` to the backend.

**Production** builds both packages (`npm run build`) and starts one process (`npm start`) that serves API + static files.

**Order creation rule:** New orders are created only through `POST /api/paypal/create-payment`. `POST /api/orders` returns **410 Gone**.

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 19, React Router 7, TypeScript, Vite 7, Framer Motion, Fuse.js, Sonner, liquid-web |
| Backend | Node.js 20, Express 4, TypeScript, postgres.js, Helmet, compression |
| Payments | PayPal Checkout (create + capture + webhooks + refunds) |
| Database | Supabase PostgreSQL (PgBouncer pooler on port 6543 recommended) |
| Cache | Redis 6 (required in production) + in-memory fallback |
| Email | Resend |
| Observability | Pino (structured logs), Sentry (backend + frontend) |
| Testing | Vitest (backend), Playwright (frontend E2E smoke) |
| Deploy | Railway (single service, repo root), Cloudflare (required proxy in production) |

---

## Storefront features

### Pages and routes

| Route | Purpose |
|-------|---------|
| `/` | Home — hero carousel, product search bar, featured products |
| `/products` | Catalog — filters, Fuse.js search, pagination; supports `?q=` deep links |
| `/product/:id` | Product detail — 360° viewer (real multi-angle or static placeholder), reviews, JSON-LD, meta tags |
| `/cart` | Shopping cart (localStorage via `CartContext`) |
| `/checkout` | Customer/shipping form, coupon validation, PayPal redirect |
| `/payment/success` | Redeems `?code=` via checkout exchange, captures payment; **409** shows “payment received — processing” (polls checkout-context; cart not cleared until confirmed); expired exchange shows explicit error |
| `/payment/cancel` | Abandoned checkout; clears `pendingOrder`, `paypalReturnCode`, and `checkoutRecovery` from sessionStorage |
| `/orders` | Customer order lookup (`POST /api/orders/lookup`); email links redeem `?code=` via `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` URLs are stripped with a deprecation warning |
| `/contact` | Contact form with CSRF-protected POST |
| `/about`, `/help` | Static content |
| `/privacy-policy`, `/terms-of-service`, `/returns-policy`, `/shipping-policy` | Legal pages |
| `/admin/login` | Admin authentication |
| `/adminshivamdashboard` | Protected admin dashboard |

### Search and catalog

- **Server:** paginated product list, filters, single-product fetch, sitemap URL export — cached in Redis when available.
- **Client:** Fuse.js fuzzy search over a full catalog cache — `getProductCatalog()` paginates through all products (`limit=100` per page) and stores results in localStorage for 15 minutes; shared search bar on Home and Products pages.

### Cart and pricing display

- Cart state persists in browser localStorage (synced across tabs via `BroadcastChannel`).
- On every cart change, `POST /api/products/validate-cart` re-validates each line against the database (product exists, current price, stock) and refreshes displayed prices via `REFRESH_PRICES`.
- Cart page shows validation errors and a **Retry validation** button when network validation fails.
- Server recalculates all totals at checkout; client totals are validated against server pricing before PayPal order creation.
- Checkout syncs customer email to activity batches on field change/blur (when analytics consent is granted), not only on initial page load.

---

## Admin dashboard

**URL:** `/adminshivamdashboard` (not under `/admin/*` to reduce scanner noise)

**Authentication:** Username + password → HttpOnly `admin_session` cookie (24-hour session). Session tokens are **SHA-256 hashed** before storage in `admin_sessions` (raw token never persisted).

**Tabs and capabilities**

| Tab | Functions |
|-----|-----------|
| Analytics | Order/revenue stats, product metrics, customer counts, geo breakdown, GA4/GSC config status; error state with retry |
| Products | Paginated list (50/page, load more, total count); error state with retry; list, create, edit, delete; bulk stock updates; image validation (URL or ≤512KB data URL) |
| Orders | Paginated list (50/page), **server-side search**, filter by status, bulk status updates (not cancellation); order modal: tracking, carrier, tracking URL, **estimated delivery**, notify shipped, status transitions, **mark paid** (PayPal capture verified via API + `admin_note` + `payment_id`), cancel with refund (paid orders cannot cancel without refund) |
| Coupons | Preset percentage coupons (5/10/20/25/50%), custom codes with **scope** (`applies_to`: all / product / category + IDs), **server product search** for product scope, **edit** (description, max uses, expiry, active), activate/deactivate, delete |
| Messages | Contact inbox — auto **mark read** on open; modal **Mark replied** / **Archive**; bulk updates; error state with retry |
| Customers | Aggregated customer list, detail view, soft delete / restore, show deleted toggle |
| Reviews | List/create/edit/delete; **server product search** when creating reviews; **customer email visible only here**; edit modal includes **admin response** (shown on storefront); filter by status; quick approve/reject; pagination (50/page); self-loads (no parent tab skeleton flash) |

**API-only admin features** (no dedicated UI tab): activity log export, PayPal refund/test endpoints.

---

## Checkout and payments

### Flow overview

```
Customer submits checkout
        │
        ▼
POST /api/paypal/create-payment
  • Validate cart (price, stock)
  • Apply coupon (server-side)
  • Claim idempotency key
  • Create pending order + decrement stock (single transaction)
  • Reserve coupon usage
  • Create PayPal order (intent: CAPTURE)
  • Bind paypal_order_id to server order
        │
        ▼
Customer approves on PayPal
        │
        ▼
POST /api/paypal/capture-payment/:paypalOrderId
  • Requires serverOrderId + order access token
  • Capture via PayPal API (with PayPal-Request-Id)
  • Validate captured amount vs order total
  • Mark order completed; upsert customer stats
  • Send confirmation email with tracking link
        │
        ▼
Payment success page redeems ?code= via GET /api/paypal/checkout-exchange/:code
```

### Create payment (`POST /api/paypal/create-payment`)

1. Validates each cart line against the database (product exists, price, stock).
2. Resolves coupon discount with scope rules (`applies_to`: all, product, or category).
3. Calculates pricing: subtotal, shipping ($25 or free over $200), tax ($0), discount, total.
4. Claims a **create_payment** idempotency key (header `X-Idempotency-Key` or fingerprint hash).
5. Atomically inserts a pending order and decrements product stock; stores `access_token_hash` and **AES-256-GCM** `access_token_encrypted` on the order row for durable post-capture email link minting.
6. Reserves coupon usage in `coupon_usage`.
7. Creates a PayPal order with `reference_id` / `custom_id` set to the server order UUID.
8. Creates a one-time **checkout exchange code** (stored hashed in `order_checkout_exchanges`, 30-minute TTL, single use).
9. Stores `paypal_order_id` on the order; returns PayPal approval links and `serverOrderId` (access token is **not** returned — redeem checkout exchange code on return).
10. On any failure after order creation: rolls back pending order, restores stock, marks idempotency key failed.

**PayPal return URL:** `{FRONTEND_URL}/payment/success?code={exchangeCode}` — PayPal appends `&token={paypalOrderId}`. Access token is **not** in the URL.

### Capture payment (`POST /api/paypal/capture-payment/:orderId`)

1. Requires `serverOrderId`, `accessToken`, and matching `paypal_order_id` binding.
2. Validates order access token against stored SHA-256 hash.
3. Claims **capture_payment** idempotency key; failed keys can be reclaimed while order is still pending.
4. Calls PayPal capture with `PayPal-Request-Id` header.
5. Handles `ORDER_ALREADY_CAPTURED` (422) by fetching existing capture details from PayPal.
6. Compares captured amount to order total; mismatch triggers auto-refund and order rollback.
7. `completeOrderPaymentCapture` sets `payment_status=completed`, `status=processing`, stores `paypal_capture_id`.
8. Upserts customer aggregate stats (only after successful capture).
9. Sends order confirmation email; caches idempotency response for safe retries.
10. Returns **409** if PayPal capture succeeds but the order is not `payment_status=completed` in the database (prevents false-success UI). The payment success page shows a processing state, polls `GET /api/paypal/checkout-context/:paypalOrderId`, and does **not** clear the cart until reconciliation completes.

### Checkout exchange (PayPal return)

`GET /api/paypal/checkout-exchange/:code` — atomically redeems the one-time `code` from the PayPal return URL and returns `accessToken`, `serverOrderId`, order totals, and coupon context. Access tokens are **AES-256-GCM encrypted** at rest in `order_checkout_exchanges`. Code is single-use and expires in 30 minutes.

### Checkout context recovery

`GET /api/paypal/checkout-context/:paypalOrderId` — restores checkout state when the exchange code is unavailable. Requires the order access token via header `X-Order-Access-Token` or query `?aid=`.

### PayPal webhooks (`POST /api/paypal/webhook`)

- Registered **before** `express.json()` with raw body parser for signature verification.
- CSRF and rate limits are skipped for this path.
- Production requires `PAYPAL_WEBHOOK_ID`; signatures verified via PayPal API.

| Event | Behavior |
|-------|----------|
| `PAYMENT.CAPTURE.COMPLETED` | Resolve capture amount from webhook or PayPal API if missing; complete order with amount validation; auto-refund on mismatch; returns **500** (PayPal retry) when order binding or capture application fails |
| `PAYMENT.CAPTURE.DENIED` | Cancel pending order, restore stock; returns **500** when order binding cannot be resolved (PayPal retry) |
| `PAYMENT.CAPTURE.REFUNDED` | Sync refund to DB with deduplication |
| `PAYMENT.CAPTURE.REVERSED` | Sync reversal with deduplication |
| `CHECKOUT.ORDER.APPROVED` / `COMPLETED` | Logged; capture handled by frontend or CAPTURE.COMPLETED |

Returns **500** on processing failure so PayPal retries.

### Refunds

| Path | Auth | Behavior |
|------|------|----------|
| `POST /api/paypal/refund/:captureId` | Admin | Validates remaining balance; partial or full refund via PayPal; `PayPal-Request-Id` idempotency |
| `POST /api/orders/:id/cancel` | Admin | Pending: cancel + restore stock; completed + refund: PayPal refund then full DB sync |

**Refund sync (`syncOrderAfterRefund`):**

- Tracks cumulative `refunded_amount` on the order (capped at order total).
- Full refund: restores inventory, marks order refunded/cancelled, reverses customer credit, releases coupon.
- Partial refund: adjusts customer `total_spent`; order stays active.
- **Deduplication:** `processed_refund_events` table prevents double-processing of webhook redeliveries or admin+webhook overlap (keyed by PayPal refund ID or webhook transmission ID).

### Payment idempotency

**Table:** `payment_idempotency`

| Operation | TTL | Key source |
|-----------|-----|------------|
| `create_payment` | 30 min | `X-Idempotency-Key` or SHA-256 fingerprint (email + items + coupon) |
| `capture_payment` | 15 min | Header or PayPal order ID |

Statuses: `processing`, `completed`, `failed`. Stuck `processing` rows are reaped after `IDEMPOTENCY_STALE_MINUTES` (default 5). Failed create/capture keys can be reclaimed when the underlying order is still pending.

---

## Orders and customers

### Order lifecycle

| `payment_status` | Meaning |
|------------------|---------|
| `pending` | Awaiting PayPal capture |
| `completed` | Payment captured |
| `failed` | Checkout failed or expired |
| `refunded` | Fully refunded |

| `status` | Meaning |
|----------|---------|
| `pending` | Awaiting payment |
| `processing` | Paid, awaiting fulfillment |
| `shipped` | Shipped (tracking set) |
| `delivered` | Delivered |
| `cancelled` | Cancelled |

### Customer order access

- Each order receives a 64-character hex **access token** at creation; a SHA-256 hash and **AES-256-GCM encrypted** copy (`access_token_encrypted`) are stored on the order row.
- Confirmation and shipping emails mint a **one-time tracking link** (`/orders?code=...`) via `order_access_exchanges`, using the encrypted token on the order (fallback: ephemeral `order_checkout_exchanges` row for legacy orders). Redeemed via `GET /api/orders/access-exchange/:code` — no long-lived token in the URL.
- Legacy deep links with `?orderNumber=&token=` in the URL are deprecated: the storefront strips them and shows a warning; customers enter credentials manually or use a fresh email link.
- Customer lookup: `POST /api/orders/lookup` with `{ orderNumber, accessToken }` in the JSON body.
- Tracked orders in `sessionStorage` auto-refresh; partial refresh failures keep last-known order data and show a non-blocking warning.
- Alternate lookup: `GET /api/orders/number/:orderNumber` with `X-Order-Access-Token` header only.
- Access token is also required for payment capture and checkout context recovery.
- Public listing of orders by email is blocked (`GET /api/orders/customer/:email` is admin-only).

### Customer aggregates

- `customers` table tracks `total_orders`, `total_spent`, dates — updated on **capture**, reversed on full refund, adjusted on partial refund.
- Soft delete supported (`is_deleted` flag).

### Admin order operations

- Update fulfillment status, tracking, carrier, estimated delivery.
- Cancel pending orders (restores stock automatically).
- Cancel completed orders with PayPal refund (syncs DB, inventory, customer stats).
- Send shipping notification email.
- **Mark paid manually** via `PATCH /api/orders/:id/payment-status` with `payment_status: completed`, `admin_note` (≥3 chars), and `payment_id` (PayPal capture ID or external reference, ≥5 chars); logged to `activity_logs` as `admin_mark_paid`.
- **Bulk updates** — `POST /api/admin/*/bulk-update` accepts at most **500** IDs per request; order bulk update validates status transitions and rejects `cancelled` and any `payment_status` change.
- Hard delete blocked when `payment_status === 'completed'`.
- Bulk status update rejects `cancelled` — use `POST /api/orders/:id/cancel` instead.

---

## Coupons and pricing

### Server pricing rules

| Rule | Value |
|------|-------|
| Free shipping threshold | $200 subtotal |
| Standard shipping | $25 |
| Tax | $0 |
| Volume discount | 10% off at 2+ items (quantity sum); 20% off at 5+ items — applied before coupon discount |

### Coupon validation

- `POST /api/coupons/validate` — public, rate-limited, cached 30s. Requires cart **`items`** (`product_id`, `quantity`); prices are loaded from the database via the same `computeCheckoutPricingForCart` helper as create-payment (volume discount, shipping, coupon scope). Response includes a **`pricing`** breakdown when valid. Checkout compares server `total` to the client total before PayPal redirect (blocks on mismatch > $0.01).
- Scope enforcement at checkout:
  - `all` — applies to full eligible cart subtotal
  - `product` — only matching `applies_to_ids` product IDs
  - `category` — products in categories derived from seed product IDs
- Minimum order, max uses, per-customer limits enforced server-side.
- `POST /api/coupons/use` returns **410 Gone** — usage recorded only during payment capture/reservation.

### Coupon reservation

At create-payment, a row in `coupon_usage` reserves the coupon for the pending order. Released automatically on cancel, expiry, or full refund.

---

## Reviews and contact

### Product reviews

- **Public API** (`GET /api/reviews/product/:productId`, `POST /api/reviews`, `POST /api/reviews/:id/vote`): responses pass through `toPublicReview()` in `backend/src/lib/reviewHelpers.ts`, which **omits `customer_email`**, `order_id`, `status`, and other internal fields. Storefront shows reviewer **name** only.
- **Admin API** (`GET /api/reviews`, `POST /api/reviews/admin`, `PATCH /api/reviews/:id`) returns full rows including **`customer_email`** for moderation and the admin **Reviews** tab.
- Public submit: rate-limited; new reviews always start as `pending`; success copy tells customers the review is **pending moderation**; submit and check use the same **generic eligibility message** when the product is missing or a duplicate review exists (no enumeration).
- Storefront **ReviewForm** calls `POST /api/reviews/check` on email blur before submit (generic eligibility message; avoids email enumeration in URLs).
- Votes: rate-limited; **only `approved` reviews** accept helpful/not-helpful votes; vote failures show a toast; buttons disable after a successful vote.
- `POST /api/reviews/check` (email in JSON body) returns `{ can_review, message }` with the same generic message when the product is missing or ineligible (no product enumeration). Legacy `GET .../:email` is deprecated (PII in URL).
- Admin can set **`admin_response`** on edit (`PATCH /api/reviews/:id`); displayed on the public product page for approved reviews.
- Voter identity for helpful votes is a server-derived daily hash from client IP + `IP_SALT` (not client-supplied).
- Verified purchase flag when reviewer email matches a completed order for that product.
- Admin dashboard: list, create, edit, delete, quick approve/reject, status filter, pagination.
- Database trigger maintains product `rating` and `review_count`.

### Contact form

- `POST /api/contact` — rate-limited, CSRF-protected.
- Stores message in `contact_messages`; sends auto-reply via Resend.
- Successful submit emits `contact_submit` activity event (consent-gated).
- Admin inbox in dashboard with status workflow: new → read → replied → archived; opening a **new** message marks it read via `PATCH /api/contact/:id/status`.

---

## Activity and analytics

### Client activity tracking

- Frontend batches page views, cart actions, checkout events (`checkout_start`, `checkout_complete`, `purchase_complete`), size/quantity changes, and **contact submit** to `POST /api/activity/batch` only when analytics cookie consent is granted (`hasAnalyticsConsent()`). Checkout email is stored in `sessionStorage` only when consent is granted (`setUserEmail` on checkout email change/blur); cleared on cookie reject.
- Allowed batch action types: `page_view`, `product_view`, `add_to_cart`, `remove_from_cart`, `checkout_start`, `checkout_complete`, `purchase_complete`, `search`, `filter_apply`, `contact_submit`, `size_select`, `quantity_change`.
- Wired on storefront: `size_select` (product detail), `quantity_change` (cart +/-), `checkout_complete` (before PayPal redirect), `purchase_complete` (payment success).
- `POST /api/activity/batch` is **CSRF-exempt** (supports `sendBeacon`) and rate-limited separately; max **20** events per batch. Response includes `inserted` and `skipped` counts; unknown action types are skipped (not persisted). Returns **500** when every valid event in the batch fails to persist. `POST /api/activity/log` returns **500** on database insert failure.
- IP addresses anonymized with daily-salted SHA-256 (`IP_SALT`); stored as `anon_{hash}`.
- `product_view` and `add_to_cart` events can bump product metrics when `canBumpProductMetric()` allows (per-IP per-product rate limit).
- Admin can query logs and export.

### Storefront analytics

- **GA4:** loaded only after cookie consent (`VITE_GA4_MEASUREMENT_ID`).
- **Google Search Console:** verification meta tag via `VITE_GSC_VERIFICATION`.
- Admin analytics tab shows GA4/GSC configuration status and links to external dashboards.

---

## Security

### Authentication and authorization

| Actor | Mechanism |
|-------|-----------|
| Admin | Bcrypt password hash (`ADMIN_PASSWORD_HASH` in production); HMAC-signed session token in HttpOnly cookie; **SHA-256 hash** stored in `admin_sessions`; optional `Authorization: Bearer` header |
| Customer orders | Per-order access token (`access_token_hash` + `access_token_encrypted` at rest); email links use one-time `order_access_exchanges` code (`GET /api/orders/access-exchange/:code`) |
| PayPal webhooks | PayPal signature verification via API |

**JWT_SECRET:** used for admin token signing; complexity rules enforced when present (32+ chars, mixed case, number, special character).

### CSRF protection

- Double-submit cookie pattern: `csrf_token` cookie + `X-CSRF-Token` header on mutating requests.
- `GET /api/csrf-token` initializes token for cross-origin API setups (in-memory cache on frontend).
- Frontend `apiFetch` retries once on CSRF 403 after refreshing token.
- Skipped for: GET/HEAD/OPTIONS, `/api/paypal/webhook`, `/api/activity/batch`.

### Rate limiting

- Per-route limits via `express-rate-limit`.
- Redis-backed store when `REDIS_URL` is set; in-memory fallback in development only — **production fails closed** if Redis is required but unavailable.
- Notable limits: admin login (5 per 15 min), contact, reviews (submit/vote/admin/check), coupon validate, payment endpoints, order lookup, product search, checkout exchange, order access exchange, review eligibility check.

### Network and transport

| Control | Detail |
|---------|--------|
| **Cloudflare** | `TRUST_CLOUDFLARE=true` required in production; blocks direct origin access; uses `CF-Connecting-IP` |
| **CORS** | Whitelist `FRONTEND_URL` + localhost dev origins; no-origin allowed in prod only for `/api/health` and webhook |
| **Helmet** | CSP (PayPal domains allowed), HSTS in production, frameguard deny, noSniff, XSS filter |
| **HTTPS** | Production redirect via `x-forwarded-proto`; optional direct SSL via cert env paths |
| **Request timeout** | 60s default (`REQUEST_TIMEOUT_MS`); slow routes use 180s (`SLOW_REQUEST_TIMEOUT_MS`): `/api/products*`, `/api/admin/analytics`, `/api/activity/*` |
| **Trust proxy** | Enabled for Railway/load balancers |

### Input and data protection

- XSS sanitization via `xss` library (`utils/sanitize.ts`).
- Parameterized SQL only (postgres.js tagged templates).
- Order secrets stripped from API responses (`stripOrderSecrets`).
- Review PII stripped from public API responses (`toPublicReview` — no `customer_email` on storefront).
- DB TLS verification in production (`DB_SSL_CA_PATH`; `rejectUnauthorized` defaults true).
- PayPal order/capture IDs have partial unique indexes to prevent duplicate binding.
- Product images validated on admin create/update: HTTPS/relative URLs or data URLs ≤512KB (`lib/productImage.ts`).
- Supabase RLS at startup (`ensureRlsPolicies()`): all **14** application tables (including `order_access_exchanges`) use **service_role-only** policies; `anon` and `authenticated` grants are revoked — no public product read via PostgREST/GraphQL; all data access goes through Express. Boot is **non-destructive** when policies already exist (skips DROP/CREATE that caused pooler lock hangs); run `migration-performance-linter-fixes.sql` once in Supabase for lint 0006 cleanup.

### Production environment gates

Backend exits on startup if missing (mirrors `backend/scripts/validate-env.mjs`):

- `DATABASE_URL`, `FRONTEND_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_USERNAME`, `JWT_SECRET` (32+ chars), `PAYPAL_WEBHOOK_ID`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, `RESEND_API_KEY`, `TRUST_CLOUDFLARE=true`, `REDIS_URL`, `SENTRY_DSN`, `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`

CI runs `npm run validate-env` in the backend job with `CI_VALIDATE_PRODUCTION=true`.

**Admin password hash:** generate locally with `node backend/scripts/generate-admin-hash.mjs "password"` — `POST /api/admin/generate-hash` is **disabled in production**.

Frontend build fails in CI/production if missing or invalid:

- `VITE_API_BASE_URL`, `VITE_SITE_URL`, `VITE_SENTRY_DSN` (no localhost or placeholder domains)

Redis connection failure in production prevents server startup.

---

## Logging and monitoring

### Pino (backend)

- JSON structured logs in production; `pino-pretty` in development.
- Log level: `LOG_LEVEL` env or `info` (prod) / `debug` (dev).
- Every request gets a child logger with `X-Request-Id` (UUID).
- **Request lifecycle:** `Request started` (method, path, IP, timeout tier) and `Request finished` (status, duration). Slow requests log at `warn` when duration ≥ `REQUEST_LOG_SLOW_MS` (default 3s).
- **DB:** `[withRetry]` logs include operation `label`, Postgres `code`, and pool stats on failure; queries ≥ `DB_SLOW_QUERY_LOG_MS` (default 2s) log as `[DB] slow query`.
- **Timeouts:** `Request timeout` includes `elapsedMs`, path, and pool stats.

### Sentry

| Layer | Package | Configuration |
|-------|---------|---------------|
| Backend | `@sentry/node` | `SENTRY_DSN` required in production; optional `SENTRY_RELEASE`; 10% trace sample rate |
| Frontend | `@sentry/react` | `VITE_SENTRY_DSN` required in CI/production builds; loads after cookie consent (`onMonitoringConsentReady`); browser tracing; optional `VITE_SENTRY_RELEASE` |

- Global Express error handler calls `captureException` with request ID, method, path; structured error logs include duration, pool stats, and guard against double responses when a timeout already sent 504.
- React `ErrorBoundary` captures render errors.
- Frontend `logError`/`logWarn`: console in dev; Sentry only in production.

### Health check

`GET /api/health` (public) returns a minimal payload (`status`, `timestamp`, `responseTime_ms`) for load balancers. Returns **503** if the database is unreachable or Redis is required but disconnected.

`GET /api/health/detail` (admin) returns database latency, pool stats, PayPal mode, Redis status, and uptime.

---

## Server startup and bootstrap

Every backend process run (`npm run dev`, `npm start`, Railway) executes `bootstrap()` in `backend/src/server.ts` unless the app is imported by tests.

### Boot sequence

| Phase | When | What runs |
|-------|------|-----------|
| **Listen** | Immediate | HTTP server on `PORT` (5000 dev) |
| **API ready (dev default)** | Immediate | `serverReady=true` — storefront can call `/api/*` while bootstrap continues |
| **Core bootstrap** | Background (dev) or blocking (prod with `BOOTSTRAP_BLOCK_API`) | DB ping → optional Redis → schema tasks (skip-if-exists) |
| **Deferred bootstrap (dev default)** | After core schema | RLS check, legacy admin session purge, cache warm |
| **Maintenance timers** | After bootstrap `.then()` | Initial run deferred; hourly + 15‑min intervals |

### Schema tasks (idempotent)

Each task runs on every start but **skips DDL** when `BOOTSTRAP_SKIP_DDL=true` or the table/index already exists:

- `ensureIdempotencyTable()` — also ensures indexes including `idx_payment_idempotency_processing_created`
- `ensureActivityLogsTable()`, `ensureOrderPaymentSchema()`, `ensureCheckoutExchangeTable()`, `ensureOrderAccessExchangeTable()`
- `ensureRlsPolicies()` — skips when marker tables already have `Service role%` policies; never DROP legacy policies unless `BOOTSTRAP_FORCE_RLS=true`
- `ensureClientGrantsRevoked()` — always runs (even when DDL is skipped); in production, startup **fails** if `anon`/`authenticated` still hold table grants after revoke
- `purgeLegacyAdminSessions()` — skips when no legacy plaintext tokens
- `warmCaches()` — always runs (~500ms); preloads product list pages

### Dev vs production

| Behavior | Development (default) | Production |
|----------|----------------------|------------|
| API before bootstrap | Yes (immediate) | No — waits for bootstrap |
| RLS before API | No (deferred) | Yes (sync path) |
| Bootstrap failure | API stays up; log error | Process exits |

**Recommended local `.env` after Supabase SQL is applied:** `BOOTSTRAP_SKIP_DDL=true`

### Typical dev log lines

```
API ready — bootstrap continues in background (dev only)
Bootstrap: skipping payment_idempotency DDL (already applied or BOOTSTRAP_SKIP_DDL)
Core bootstrap complete — deferred RLS/cache tasks may still be running in background
Deferred bootstrap complete
Maintenance jobs scheduled (first run in 120000ms)
Maintenance: step finished  step=reap_idempotency durationMs=…
Maintenance: skipped (database unreachable)  — one line when laptop sleeps or DNS fails; retries resume on next interval
```

See [RESTART_BACKEND.md](RESTART_BACKEND.md) and [DATABASE_SETUP.md](DATABASE_SETUP.md).

---

## Caching and Redis

### Redis (`REDIS_URL`)

- **Required in production** — startup fails without successful connection.
- Used for: application cache (prefix `labdoor:cache:`) and rate limit counters (prefix `rl:`).

### Hybrid cache strategy

1. Read from Redis if available.
2. Fall back to in-memory `Map`.
3. Write-through to both on cache miss.

| Resource | TTL | Invalidation |
|----------|-----|--------------|
| Product list pages | 60s | Product admin writes |
| Single product | 120s | Product admin writes |
| Coupon validation | 30s | Coupon admin writes |

### Cache warming

On server startup, preloads product list pages (limits 10 and 20) to reduce cold-start latency.

---

## Email

Powered by **Resend** (`RESEND_API_KEY`, `SENDER_EMAIL`, `COMPANY_NAME`, `COMPANY_SUPPORT_EMAIL`).

| Email | Trigger |
|-------|---------|
| Order confirmation | After successful PayPal capture — includes tracking URL with access token |
| Shipping notification | Admin `POST /api/orders/:id/notify-shipped` |
| Order cancellation | Admin cancel with refund details |
| Contact auto-reply | Contact form submission |

---

## Maintenance jobs

Started after core bootstrap completes (`maintenanceJobs.ts`). The **initial run** logs each step (`Maintenance: step started` / `step finished`). Scheduled hourly and 15-minute jobs **ping the database first**; if the pooler is unreachable (sleep, Wi‑Fi drop, `CONNECT_TIMEOUT`, `ENOTFOUND`), they log a single compact warning and skip — no stack traces per cleanup task.

| Job | Interval | Action |
|-----|----------|--------|
| **Initial run** | `MAINTENANCE_DEFER_MS` after boot (default 120s) | DB ping → expire stale orders → reap stuck idempotency keys |
| Hourly bundle | 1 hour | Ping → idempotency cleanup → stale orders → checkout exchange cleanup → order access exchange cleanup |
| Stuck idempotency reaper | 15 min | Ping → mark long-running `processing` rows as `failed` (batched, `FOR UPDATE SKIP LOCKED`) |

**Idempotency reaper:** uses partial index `idx_payment_idempotency_processing_created` (existence cached in memory after first check); batch size `IDEMPOTENCY_REAP_BATCH_SIZE` (default 50); max batches per run `IDEMPOTENCY_REAP_MAX_BATCHES` (default 10). On Supabase pooler, statements are capped at ~120s — batched reaper avoids statement timeouts. Healthy runs with nothing to reap stay silent (no periodic “no stuck keys” spam).

### Maintenance warnings vs wrong `DATABASE_URL`

A **correct** `DATABASE_URL` can still produce occasional maintenance warnings when the machine or network is briefly unreachable. Distinguish by **when** errors appear:

| Symptom | Likely cause | Action |
|---------|----------------|--------|
| Bootstrap succeeds (`Bootstrap: database reachable`, cache warmed); API and checkout work; later `Maintenance: skipped (database unreachable)` with `CONNECT_TIMEOUT` or `ENOTFOUND` | Transient pool/DNS blip — laptop sleep, Wi‑Fi drop, VPN toggle | **None** — jobs retry on the next interval (15 min / 1 hour) when connectivity returns |
| Bootstrap fails immediately or every API call returns 500/503; `Database ping timed out` at startup | Wrong host/port, paused Supabase project, firewall, or invalid credentials | Fix `DATABASE_URL`, wake project in Supabase dashboard, verify pooler port **6543** with `?pgbouncer=true` |
| `[withRetry] transient failure` on live requests | Same as first row — pooler blip during a user request | Usually self-heals; increase `MAINTENANCE_DB_RETRIES` only if maintenance skips persist while you are actively online |

**Wrong URL** fails at **first connection** (bootstrap ping). **Transient errors** appear **after hours of successful operation** — that pattern does not mean the URL is incorrect.

---

## SEO and sitemap

### Build-time generation

`frontend/scripts/generate-sitemap.mjs` runs during `npm run build`:

1. Fetches product URLs from `GET /api/products/sitemap-urls` (fallback: paginated product list).
2. Writes `public/sitemap.xml` and `public/robots.txt`.

**Production/CI builds** require product URLs unless `SITEMAP_REQUIRE_PRODUCTS=false` is explicitly set. CI sitemap job sets `SITEMAP_REQUIRE_PRODUCTS=true`.

### robots.txt rules

- **Allow:** public pages
- **Disallow:** `/admin/`, `/adminshivamdashboard`, `/checkout`, `/cart`, `/payment/`
- **Sitemap:** `{VITE_SITE_URL}/sitemap.xml`

### On-page SEO

- `MetaTags` component — title, description, OG tags, canonical URL via `VITE_SITE_URL`
- `ProductJsonLd` — structured data on product pages
- Google Search Console verification meta tag

---

## Database

**Provider:** Supabase PostgreSQL  
**Access:** Backend uses service role via `DATABASE_URL`  
**Pooler:** Port 6543 with `prepare: false` recommended for production

### Core tables

| Table | Purpose |
|-------|---------|
| `products` | Catalog — price, stock, category, size, color, ratings |
| `orders` | Orders — JSONB items/shipping, PayPal IDs, `refunded_amount`, `access_token_hash`, `access_token_encrypted` |
| `customers` | Aggregated customer stats, soft delete |
| `coupons` | Discount rules, scope, validity, usage limits |
| `coupon_usage` | Per-order coupon reservations |
| `contact_messages` | Contact inbox |
| `activity_logs` | Anonymized activity events |
| `admin_sessions` | Admin session token hashes (SHA-256) |
| `order_checkout_exchanges` | One-time PayPal return codes → order access tokens |
| `reviews` / `review_votes` | Product reviews and voting |

### Payment tables (runtime migrations at startup)

| Table | Purpose |
|-------|---------|
| `payment_idempotency` | Create/capture deduplication with cached responses |
| `processed_refund_events` | Refund webhook and admin refund deduplication |

### Schema files

- `backend/src/database/schema.sql` — base schema
- `backend/src/database/migration-*.sql` — incremental migrations (run in Supabase SQL editor), including `migration-order-checkout-exchange.sql` and `migration-order-access-token-encrypted.sql`
- **Boot applies (skip-if-exists):** `ensureIdempotencyTable()`, `ensureOrderPaymentSchema()`, `ensureCheckoutExchangeTable()`, `ensureOrderAccessExchangeTable()`, `ensureRlsPolicies()`
- `backend/src/database/migration-rls-tighten.sql` — reference SQL for RLS (mirrors boot logic)
- `backend/src/database/migration-performance-linter-fixes.sql` — **run once manually** in Supabase: FK indexes (lint 0001) and consolidate duplicate RLS policies (lint 0006). Not applied destructively at boot (use `BOOTSTRAP_FORCE_RLS=true` only if you intentionally want legacy DROP on restart).
- `backend/src/database/migration-payment-idempotency.sql` — includes partial index for reaper (`idx_payment_idempotency_processing_created`); boot also creates this index via `ensureIdempotencyIndexes()` when missing

---

## Complete API endpoints

**Base URL (local dev):** `http://localhost:5173` (Vite) with `/api` proxied to `http://localhost:5000`  
**Base URL (local production-like):** `http://localhost:5000`  
**Base URL (production):** `https://www.yourdomain.com` — API at `/api` (`VITE_API_BASE_URL=/api`)

**Auth legend**

| Label | Meaning |
|-------|---------|
| Public | No login required |
| CSRF | State-changing methods require `X-CSRF-Token` header + `csrf_token` cookie (SPA uses `/api/csrf-token`) |
| Admin | `admin_session` HttpOnly cookie or `Authorization: Bearer` |
| Order token | Per-order access token via `X-Order-Access-Token` header or `?aid=` query (legacy `?token=` URLs stripped on `/orders`) |
| PayPal | Webhook signature verification (`PAYPAL_WEBHOOK_ID`) |

Expanded request/response docs: [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md)

### Core (`backend/src/server.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/csrf-token` | Public | Issue CSRF cookie + token for SPA |
| GET | `/api/health` | Public | Minimal health check (DB ping); used by Railway |
| GET | `/api/health/detail` | Admin | Full service diagnostics |
| POST | `/api/paypal/webhook` | PayPal | PayPal event webhook (raw JSON body) |
| GET | `/api/paypal/test` | Admin | PayPal API connectivity test |
| POST | `/api/paypal/create-payment` | Public + CSRF | Create pending order + PayPal order |
| POST | `/api/paypal/capture-payment/:orderId` | Order token + CSRF | Capture PayPal payment after approval |
| GET | `/api/paypal/checkout-exchange/:code` | Public | Redeem one-time checkout code → access token |
| GET | `/api/paypal/checkout-context/:paypalOrderId` | Order token | Checkout recovery when exchange code is unavailable |
| GET | `/api/paypal/order/:orderId` | Admin | Fetch PayPal order details |
| POST | `/api/paypal/refund/:captureId` | Admin + CSRF | Issue full or partial refund |

Any unmatched `/api/*` path returns **404** JSON `{ error: "Route not found" }`.

### Products (`/api/products` — `backend/src/routes/products.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | Public | List products (pagination, filters) |
| GET | `/api/products/filters` | Public | Available filter facets |
| GET | `/api/products/sitemap-urls` | Public | Product IDs/paths for sitemap generation |
| GET | `/api/products/category/:category` | Public | Products by category slug |
| GET | `/api/products/:id` | Public | Single product by ID |
| POST | `/api/products/search` | Public + CSRF | Fuse.js product search |
| POST | `/api/products/validate-cart` | Public + CSRF | Validate cart lines (price, stock, existence) |
| POST | `/api/products` | Admin + CSRF | Create product |
| PUT | `/api/products/:id` | Admin + CSRF | Update product |
| DELETE | `/api/products/:id` | Admin + CSRF | Delete product |

### Orders (`/api/orders` — `backend/src/routes/orders.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | — | **410 Gone** — use `POST /api/paypal/create-payment` |
| GET | `/api/orders` | Admin | List all orders (pagination, status filters, `?search=` on order number/email/name) |
| GET | `/api/orders/access-exchange/:code` | Public | Redeem email tracking link (one-time) |
| POST | `/api/orders/lookup` | Public + CSRF | Lookup order by `orderNumber` + `accessToken` in request body |
| GET | `/api/orders/stats/summary` | Admin | Order/revenue summary stats |
| GET | `/api/orders/number/:orderNumber` | Order token or Admin | Lookup by order number |
| GET | `/api/orders/customer/:email` | Admin | Orders for customer email |
| GET | `/api/orders/:id` | Order token or Admin | Lookup by order UUID |
| PUT | `/api/orders/:id` | Admin + CSRF | Update order fields |
| PATCH | `/api/orders/:id/status` | Admin + CSRF | Update fulfillment status |
| PATCH | `/api/orders/:id/payment-status` | Admin + CSRF | Update payment status |
| POST | `/api/orders/:id/cancel` | Admin + CSRF | Cancel order (+ inventory restore) |
| DELETE | `/api/orders/:id` | Admin + CSRF | Delete order |
| POST | `/api/orders/:id/notify-shipped` | Admin + CSRF | Send shipped notification email |

### Coupons (`/api/coupons` — `backend/src/routes/coupons.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/coupons/validate` | Public + CSRF | Validate coupon code at checkout |
| POST | `/api/coupons/use` | — | **410 Gone** — usage recorded at capture |
| GET | `/api/coupons` | Admin | List coupons |
| GET | `/api/coupons/:id` | Admin | Single coupon |
| POST | `/api/coupons` | Admin + CSRF | Create coupon |
| PUT | `/api/coupons/:id` | Admin + CSRF | Update coupon |
| PATCH | `/api/coupons/:id/toggle` | Admin + CSRF | Enable/disable coupon |
| DELETE | `/api/coupons/:id` | Admin + CSRF | Delete coupon |
| GET | `/api/coupons/:id/usage` | Admin | Coupon redemption history |

### Reviews (`/api/reviews` — `backend/src/routes/reviews.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/reviews/product/:productId` | Public | Approved reviews — **`customer_email` stripped** via `toPublicReview()` |
| POST | `/api/reviews` | Public + CSRF | Submit review (pending; response stripped of email) |
| POST | `/api/reviews/:id/vote` | Public + CSRF | Vote on **approved** reviews only |
| POST | `/api/reviews/check` | Public + CSRF | Body `{ product_id, email }` → generic `{ can_review }` (no email enumeration) |
| GET | `/api/reviews` | Admin | List all reviews **including `customer_email`** |
| POST | `/api/reviews/admin` | Admin + CSRF | Create review (name, rating, text, optional email) |
| PATCH | `/api/reviews/:id` | Admin + CSRF | Edit review fields and status |
| DELETE | `/api/reviews/:id` | Admin + CSRF | Delete review |

### Contact (`/api/contact` — `backend/src/routes/contact.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/contact` | Public + CSRF | Submit contact form |
| GET | `/api/contact` | Admin | List contact messages |
| GET | `/api/contact/stats/summary` | Admin | Inbox summary stats |
| GET | `/api/contact/:id` | Admin | Single message |
| PATCH | `/api/contact/:id/status` | Admin + CSRF | Update message status |
| DELETE | `/api/contact/:id` | Admin + CSRF | Delete message |

### Activity (`/api/activity` — `backend/src/routes/activity.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/activity/log` | Public + CSRF | Log single analytics event |
| POST | `/api/activity/batch` | Public (CSRF-exempt) | Log batched events (max 20; rate-limited) |
| GET | `/api/activity/export` | Admin | Export activity logs |
| GET | `/api/activity/logs` | Admin | Query activity logs |
| GET | `/api/activity/stats` | Admin | Aggregated activity stats |

### Admin (`/api/admin` — `backend/src/routes/admin.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/login` | Public + CSRF | Admin login; sets `admin_session` cookie |
| POST | `/api/admin/generate-hash` | Public (dev only) | Generate bcrypt hash — **403 in production**; use `scripts/generate-admin-hash.mjs` |
| POST | `/api/admin/logout` | Admin + CSRF | Logout; clears session |
| GET | `/api/admin/verify` | Public | Session probe — always **200** with `{ authenticated: true \| false }` (not 401 when logged out) |
| GET | `/api/admin/sessions` | Admin | List active admin sessions |
| POST | `/api/admin/sessions/cleanup` | Admin + CSRF | Purge expired sessions |
| GET | `/api/admin/analytics` | Admin | Dashboard analytics payload |
| GET | `/api/admin/customers` | Admin | Customer list |
| GET | `/api/admin/customers/:email` | Admin | Customer detail by email |
| POST | `/api/admin/customers/:id/restore` | Admin + CSRF | Restore soft-deleted customer |
| DELETE | `/api/admin/customers/:id` | Admin + CSRF | Soft-delete customer |
| POST | `/api/admin/products/bulk-update` | Admin + CSRF | Bulk product field updates |
| POST | `/api/admin/orders/bulk-update` | Admin + CSRF | Bulk order status updates |
| POST | `/api/admin/messages/bulk-update` | Admin + CSRF | Bulk contact message status updates |

**Endpoint count:** 72 routes (70 active + 2 deprecated **410** responses: `POST /api/orders`, `POST /api/coupons/use`).

---

## Webpage URLs

**SPA routing:** React Router in `frontend/src/App.tsx` (`BrowserRouter`). Production base URL is `VITE_SITE_URL` (default `https://www.labdoorcustoms.com`). Local dev: `http://localhost:5173`.

### Storefront routes

| URL | Page component | Notes |
|-----|----------------|-------|
| `/` | `Home` | Landing page, carousel, featured products |
| `/products` | `ProductsPage` | Catalog; optional query `?q=` for search |
| `/product/:id` | `ProductDetailPage` | `:id` = numeric product ID; also in sitemap |
| `/about` | `AboutUs` | About page |
| `/contact` | `ContactUs` | Contact form |
| `/help` | `HelpCenter` | Help / FAQ |
| `/privacy-policy` | `PrivacyPolicy` | Privacy policy |
| `/terms-of-service` | `TermsOfService` | Terms of service |
| `/returns-policy` | `ReturnsPolicy` | Returns policy |
| `/shipping-policy` | `ShippingPolicy` | Shipping policy |
| `/cart` | `CartPage` | Shopping cart |
| `/checkout` | `Checkout` | Checkout form + PayPal redirect |
| `/orders` | `MyOrders` | Order lookup via POST body; email links use `?code=`; legacy `?orderNumber=&token=` stripped with deprecation warning |
| `/payment/success` | `PaymentSuccess` | PayPal return; query params `code` (exchange), `token` (PayPal order ID); optional `aid` (access token) |
| `/payment/cancel` | `Cancel` | PayPal cancel return |

### Admin routes

| URL | Page component | Notes |
|-----|----------------|-------|
| `/admin/login` | `AdminLogin` | Admin sign-in |
| `/adminshivamdashboard` | `AdminDashboard` | Protected; redirects to `/admin/login` if unauthenticated |

**Admin dashboard sections** (same URL, in-app tabs — not separate routes): Analytics, Products, Orders, Coupons, Messages, Customers.

### Fallback

| URL | Behavior |
|-----|----------|
| `*` (any unmatched path) | Inline **404** page with “Go Home” link |

### Static public files (`frontend/public/`)

| URL | File | Notes |
|-----|------|-------|
| `/sitemap.xml` | `public/sitemap.xml` | Static pages + build-time product URLs via `scripts/generate-sitemap.mjs` |
| `/robots.txt` | `public/robots.txt` | Disallows `/admin/`, `/adminshivamdashboard`, `/checkout`, `/cart`, `/payment/` |

### Sitemap static paths (also in `generate-sitemap.mjs`)

`/`, `/products`, `/about`, `/contact`, `/help`, `/privacy-policy`, `/terms-of-service`, `/returns-policy`, `/shipping-policy`, plus dynamic `/product/{id}` entries from `GET /api/products/sitemap-urls` at build time.

### URLs referenced in navigation (not separate routes)

Footer/header links use the routes above. Product search navigates to `/products?q={query}`. Cart badge and checkout flow link `/cart` → `/checkout` → PayPal → `/payment/success` or `/payment/cancel`.

---

## Environment variables

Templates: `backend/env.template`, `frontend/env.template`

### Backend — required in production

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (pooler port 6543) |
| `FRONTEND_URL` | CORS, CSP, PayPal return URLs |
| `ADMIN_PASSWORD_HASH` | Bcrypt admin password |
| `ADMIN_USERNAME` | Admin login username |
| `JWT_SECRET` | Admin session signing (32+ chars required) |
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | PayPal API credentials |
| `PAYPAL_WEBHOOK_ID` | Webhook signature verification |
| `RESEND_API_KEY` | Transactional email |
| `TRUST_CLOUDFLARE` | Must be `true` |
| `REDIS_URL` | Cache and rate limits |
| `SENTRY_DSN` | Error tracking |

### Backend — payment and auth (optional in dev)

| Variable | Purpose |
|----------|---------|
| `PAYPAL_MODE` | `sandbox` or `live` |

### Backend — optional / operational

| Variable | Default | Purpose |
|----------|---------|---------|
| `PENDING_ORDER_TTL_HOURS` | 24 | Abandoned checkout expiry |
| `IDEMPOTENCY_STALE_MINUTES` | 5 | Stuck idempotency reaper |
| `IDEMPOTENCY_REAP_BATCH_SIZE` | 50 | Rows per reaper/cleanup batch |
| `IDEMPOTENCY_REAP_MAX_BATCHES` | 10 | Max reaper batches per maintenance run |
| `MAINTENANCE_DEFER_MS` | 120000 | Delay first maintenance run after bootstrap |
| `MAINTENANCE_DB_RETRIES` | 2 | Retries per maintenance DB step on transient pool/network errors |
| `MAINTENANCE_DB_RETRY_MS` | 1000 | Base backoff (ms) between maintenance DB retries |
| `DB_STATEMENT_TIMEOUT_MS` | 300000 | Postgres `statement_timeout` per connection (client-side; Supabase pooler may still cap ~120s) |
| `BOOTSTRAP_BLOCK_UNTIL_RLS` | — | Dev only: set `true` to block API ready until RLS migration finishes (production always waits) |
| `BOOTSTRAP_BLOCK_API` | — | Dev only: set `true` to return 503 until full bootstrap completes (default: API ready immediately in dev) |
| `BOOTSTRAP_SKIP_DDL` | — | Skip boot-time CREATE TABLE/INDEX when schema already exists in Supabase |
| `BOOTSTRAP_FORCE_RLS` | — | Drop legacy RLS policies on boot (default off; run `migration-performance-linter-fixes.sql` once instead) |
| `BOOTSTRAP_PING_TIMEOUT_MS` | 20000 | Fail fast if database is unreachable at bootstrap start |
| `REQUEST_TIMEOUT_MS` | 60000 | HTTP request timeout |
| `SLOW_REQUEST_TIMEOUT_MS` | 180000 | Catalog, admin analytics, activity routes |
| `VITE_API_TIMEOUT_MS` | 60000 | Frontend default `apiFetch` timeout |
| `VITE_EXTENDED_API_TIMEOUT_MS` | 180000 | Frontend `slowApiFetch` (catalog, analytics, activity) |
| `LOG_LEVEL` | info/debug | Pino log level |
| `REQUEST_LOG_SLOW_MS` | 3000 | Warn when a request exceeds this duration |
| `DB_SLOW_QUERY_LOG_MS` | 2000 | Log slow database queries at warn |
| `RESEND_API_KEY` | — | Email sender (required in production) |
| `ORDER_TOKEN_ENCRYPTION_KEY` | — | AES-256-GCM key for checkout exchange token encryption (required in production) |
| `IP_SALT` | — | Activity log IP anonymization and review voter IDs (required in production) |
| `DB_SSL_CA_PATH` | — | TLS CA bundle for production DB |
| `SERVE_FRONTEND` | — | `false` disables static SPA hosting; auto-enabled in production when `frontend/dist` exists |
| `FRONTEND_DIST_PATH` | `frontend/dist` | Path to built React SPA served by Express |

### Frontend — required at production/CI build

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | API base path or URL — `/api` in production (same origin) |
| `VITE_SITE_URL` | Canonical site URL for SEO/sitemap |
| `VITE_SENTRY_DSN` | Frontend error tracking |

### Frontend — optional

| Variable | Purpose |
|----------|---------|
| `VITE_BACKEND_URL` | Backend origin for non-API calls |
| `VITE_GA4_MEASUREMENT_ID` | Google Analytics (consent-gated) |
| `VITE_GSC_VERIFICATION` | Search Console verification token |
| `SITEMAP_REQUIRE_PRODUCTS` | Fail build if sitemap has zero products |
| `SITEMAP_API_BASE_URL` | Absolute API URL for sitemap product fetch during build (defaults from `VITE_API_BASE_URL` + `VITE_SITE_URL`) |

---

## CI/CD and deployment

### GitHub Actions (`.github/workflows/ci.yml`)

| Job | Steps |
|-----|-------|
| monorepo | Root `npm ci`, backend validate-env, `npm run build` (`VITE_API_BASE_URL=/api`), Vitest, Playwright smoke |
| sitemap | Requires `PRODUCTION_API_BASE_URL`; generates sitemap with live product URLs |
| links | Markdown link checker |

### Keep-alive (`.github/workflows/keep-supabase-alive.yml`)

Cron every 6 days — pings database via `backend/scripts/keep-alive.js` (requires `DATABASE_URL` secret).

### Dependabot

Weekly patch/minor updates for Express, PayPal SDK, React, Sentry, GitHub Actions.

### Deployment pattern

- **Railway service** at repository root — `npm run build && npm start`; healthcheck `/api/health`
- **DNS:** Cloudflare proxy on the public domain (`www.yourdomain.com`)
- **API path:** `/api` on the same host as the storefront
- **CI secrets:** `PRODUCTION_API_BASE_URL` (sitemap job), `VITE_SENTRY_DSN`, `DATABASE_URL`

See [`PRE_LAUNCH_CHECKLIST.md`](PRE_LAUNCH_CHECKLIST.md) before first production traffic, plus [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`CLOUDFLARE_RAILWAY.md`](CLOUDFLARE_RAILWAY.md).

---

## Local development

```bash
# From repository root (monorepo)
cp backend/env.template backend/.env   # DATABASE_URL, PayPal sandbox, ADMIN_PASSWORD_HASH, etc.
cp frontend/env.template frontend/.env # VITE_API_BASE_URL=/api (default)
npm install                            # installs frontend + backend workspaces
npm run dev                            # API :5000 + Vite :5173 (proxy /api)
```

**API-only mode** (no static hosting): `cd backend && npm run dev`

**Production-like single server locally:**

```bash
npm run build
cd backend && SERVE_FRONTEND=true npm start   # http://localhost:5000
```

**Admin password:** generate `ADMIN_PASSWORD_HASH` with `node backend/scripts/generate-admin-hash.mjs "your-password"` (plaintext `ADMIN_PASSWORD` is rejected at startup).

**Strict env validation** is skipped locally unless `CI=true` or `NODE_ENV=production`.

**After Supabase schema is applied**, add to `backend/.env`:

```env
BOOTSTRAP_SKIP_DDL=true
LOG_LEVEL=debug
```

This skips CREATE TABLE/INDEX on every restart and enables detailed request/DB logs. See [Logging and monitoring](#logging-and-monitoring).

```bash
npm test                         # All tests: backend unit + API + frontend UI (reports per suite)
npm run test:backend             # Backend unit only
npm run test:api                 # API integration only
npm run test:frontend            # Playwright UI only
npm run validate-env             # backend + frontend env checks
npm run build                    # frontend + backend
npm run links:check
```

---

## Testing

| Suite | Tool | Coverage |
|-------|------|----------|
| Backend unit/API | Vitest | Checkout validation + create-payment happy path, capture 409/refund mismatch, checkout-context API, checkout exchange, PayPal webhooks (COMPLETED + DENIED), admin mark-paid, coupon scope, `computeCheckoutPricingForCart`, payment idempotency, order tokens, RLS table list + grant revoke, email portal URL, activity batch/log, order lookup, reviews check |
| Frontend E2E / UI | Playwright | Storefront smoke, products/cart/checkout/contact UI, navigation, cookie consent, payment-success/orders edge UI, checkout total mismatch, admin login/dashboard smoke, mobile viewport (28 tests; mocked API) |

**Total automated tests:** 149 (81 backend unit + 40 API + 28 Playwright UI).

| Link check | Custom script | Documentation internal links |

API tests mock the database layer (`Tests/setup.ts`) for fast isolated runs.

**Detailed runbook:** [test_guidelines.md](test_guidelines.md) — automated tests, manual QA, CI, commands, and policy (run tests only when explicitly requested).

---

## Related documentation

| Document | Topic |
|----------|-------|
| [test_guidelines.md](test_guidelines.md) | Testing — automated, manual QA, CI, when to run |
| [PROJECT_AUDIT.md](PROJECT_AUDIT.md) | Full audit snapshot and remediation backlog |
| [COVERAGE_MATRIX.md](COVERAGE_MATRIX.md) | Critical path coverage — update with behavior changes |
| [QUICK_START.md](QUICK_START.md) | 10-minute local setup |
| [API_DOCUMENTATION.md](API_DOCUMENTATION.md) | Full REST API |
| [PRE_LAUNCH_CHECKLIST.md](PRE_LAUNCH_CHECKLIST.md) | Go-live checklist |
| [DEPLOYMENT.md](DEPLOYMENT.md) | Production deploy |
| [ADMIN_DASHBOARD_GUIDE.md](ADMIN_DASHBOARD_GUIDE.md) | Admin UI |
| [PAYPAL_SETUP_GUIDE.md](PAYPAL_SETUP_GUIDE.md) | PayPal credentials and webhooks |
| [DATABASE_SETUP.md](DATABASE_SETUP.md) | Schema and migrations |

**Full index:** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
