# Lab Door Customs — Project Reference

**Lab Door Customs** is a full-stack e-commerce application for custom footwear. A React storefront handles browsing, cart, and PayPal checkout; an Express API owns pricing, inventory, orders, admin operations, and PayPal webhooks. PostgreSQL (Supabase) is the system of record.

**Documentation hub:** [`documentation/DOCUMENTATION_INDEX.md`](documentation/DOCUMENTATION_INDEX.md)

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
12. [Caching and Redis](#caching-and-redis)
13. [Email](#email)
14. [Maintenance jobs](#maintenance-jobs)
15. [SEO and sitemap](#seo-and-sitemap)
16. [Database](#database)
17. [Complete API endpoints](#complete-api-endpoints)
18. [Webpage URLs](#webpage-urls)
19. [Environment variables](#environment-variables)
20. [CI/CD and deployment](#cicd-and-deployment)
21. [Local development](#local-development)
22. [Testing](#testing)

---

## Architecture

```
┌─────────────────┐     HTTPS/CORS      ┌──────────────────┐
│  React SPA      │ ◄──────────────────►│  Express API     │
│  (Vite build)   │   CSRF + cookies    │  (TypeScript)    │
└────────┬────────┘                     └────────┬─────────┘
         │                                       │
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
| `frontend/` | React 19 SPA — pages, cart, checkout, admin UI |
| `backend/` | Express REST API — routes, PayPal, jobs, cache |
| `.github/workflows/` | CI, Supabase keep-alive cron |
| `documentation/` | Setup, deploy, and operational guides |
| `scripts/` | Root link checker, doc sync utilities |

**Order creation rule:** New orders are created only through `POST /api/paypal/create-payment`. The legacy `POST /api/orders` endpoint returns **410 Gone**.

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
| Deploy | Railway (backend + frontend services), Cloudflare (required proxy in production) |

---

## Storefront features

### Pages and routes

| Route | Purpose |
|-------|---------|
| `/` | Home — hero carousel, product search bar, featured products |
| `/products` | Catalog — filters, Fuse.js search, pagination; supports `?q=` deep links |
| `/product/:id` | Product detail — 360° viewer, reviews, JSON-LD, meta tags |
| `/cart` | Shopping cart (localStorage via `CartContext`) |
| `/checkout` | Customer/shipping form, coupon validation, PayPal redirect |
| `/payment/success` | Post-PayPal capture, order confirmation, cart clear |
| `/payment/cancel` | Abandoned checkout |
| `/orders` | Customer order lookup (order number + access token) |
| `/contact` | Contact form with CSRF-protected POST |
| `/about`, `/help` | Static content |
| `/privacy-policy`, `/terms-of-service`, `/returns-policy`, `/shipping-policy` | Legal pages |
| `/admin/login` | Admin authentication |
| `/adminshivamdashboard` | Protected admin dashboard |

### Search and catalog

- **Server:** paginated product list, filters, single-product fetch, sitemap URL export — cached in Redis when available.
- **Client:** Fuse.js fuzzy search with a 15-minute localStorage catalog cache; shared search bar on Home and Products pages.

### Cart and pricing display

- Cart state persists in browser localStorage.
- Server recalculates all totals at checkout; client totals are validated against server pricing before PayPal order creation.

---

## Admin dashboard

**URL:** `/adminshivamdashboard` (not under `/admin/*` to reduce scanner noise)

**Authentication:** Username + password → HttpOnly `admin_session` cookie (24-hour session stored in `admin_sessions` table).

**Tabs and capabilities**

| Tab | Functions |
|-----|-----------|
| Analytics | Order/revenue stats, product metrics, customer counts, geo breakdown, GA4/GSC config status |
| Products | List, create, edit, delete; bulk stock updates |
| Orders | Filter, status updates, cancel with optional PayPal refund, shipping notifications |
| Messages | Contact inbox — read, reply status, archive, bulk updates |
| Customers | Aggregated customer list, detail view, soft delete / restore |

**API-only admin features** (no dedicated UI tab): coupon CRUD, review moderation, activity log export.

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
Payment success page (also supports ?aid= token recovery)
```

### Create payment (`POST /api/paypal/create-payment`)

1. Validates each cart line against the database (product exists, price, stock).
2. Resolves coupon discount with scope rules (`applies_to`: all, product, or category).
3. Calculates pricing: subtotal, shipping ($25 or free over $200), tax ($0), discount, total.
4. Claims a **create_payment** idempotency key (header `X-Idempotency-Key` or fingerprint hash).
5. Atomically inserts a pending order and decrements product stock.
6. Reserves coupon usage in `coupon_usage`.
7. Creates a PayPal order with `reference_id` / `custom_id` set to the server order UUID.
8. Stores `paypal_order_id` on the order; returns PayPal approval links, `serverOrderId`, and a one-time **access token**.
9. On any failure after order creation: rolls back pending order, restores stock, marks idempotency key failed.

**PayPal return URL:** `{FRONTEND_URL}/payment/success?aid={accessToken}`

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

### Checkout context recovery

`GET /api/paypal/checkout-context/:paypalOrderId` — restores checkout state when localStorage is unavailable after PayPal redirect. Requires access token via query `aid`, `?token=`, or header `X-Order-Access-Token`.

### PayPal webhooks (`POST /api/paypal/webhook`)

- Registered **before** `express.json()` with raw body parser for signature verification.
- CSRF and rate limits are skipped for this path.
- Production requires `PAYPAL_WEBHOOK_ID`; signatures verified via PayPal API.

| Event | Behavior |
|-------|----------|
| `PAYMENT.CAPTURE.COMPLETED` | Complete order with amount validation; auto-refund on mismatch |
| `PAYMENT.CAPTURE.DENIED` | Cancel pending order, restore stock |
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

- Each order receives a 64-character hex **access token** at creation; only a SHA-256 hash is stored.
- Token is embedded in confirmation email tracking URLs.
- Required for: `GET /api/orders/number/:orderNumber`, capture payment, checkout context recovery.
- Public listing of orders by email is blocked (`GET /api/orders/customer/:email` is admin-only).

### Customer aggregates

- `customers` table tracks `total_orders`, `total_spent`, dates — updated on **capture**, reversed on full refund, adjusted on partial refund.
- Soft delete supported (`is_deleted` flag).

### Admin order operations

- Update fulfillment status, tracking, carrier, estimated delivery.
- Cancel pending orders (restores stock automatically).
- Cancel completed orders with PayPal refund (syncs DB, inventory, customer stats).
- Send shipping notification email.
- Hard delete blocked when `payment_status === 'completed'`.

---

## Coupons and pricing

### Server pricing rules

| Rule | Value |
|------|-------|
| Free shipping threshold | $200 subtotal |
| Standard shipping | $25 |
| Tax | $0 |

### Coupon validation

- `POST /api/coupons/validate` — public, rate-limited, cached 30s.
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

- Public: list by product, submit review, vote helpful/not helpful.
- Verified purchase flag when reviewer email matches a completed order for that product.
- Admin: list all, approve/reject, delete.
- Database trigger maintains product `rating` and `review_count`.

### Contact form

- `POST /api/contact` — rate-limited, CSRF-protected.
- Stores message in `contact_messages`; sends auto-reply via Resend.
- Admin inbox in dashboard with status workflow: new → read → replied → archived.

---

## Activity and analytics

### Client activity tracking

- Batches page views, cart actions, checkout events to `POST /api/activity/batch`.
- IP addresses anonymized with daily-salted SHA-256 (`IP_SALT`).
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
| Admin | Bcrypt password hash (`ADMIN_PASSWORD_HASH` in production); HMAC-signed session token in HttpOnly cookie; validated against `admin_sessions`; legacy Bearer header supported |
| Customer orders | Per-order access token (hashed at rest) |
| PayPal webhooks | PayPal signature verification via API |

**JWT_SECRET:** used for admin token signing; complexity rules enforced when present (32+ chars, mixed case, number, special character).

### CSRF protection

- Double-submit cookie pattern: `csrf_token` cookie + `X-CSRF-Token` header on mutating requests.
- `GET /api/csrf-token` initializes token for cross-origin API setups (in-memory cache on frontend).
- Frontend `apiFetch` retries once on CSRF 403 after refreshing token.
- Skipped for: GET/HEAD/OPTIONS, `/api/paypal/webhook`.

### Rate limiting

- Per-route limits via `express-rate-limit`.
- Redis-backed store when `REDIS_URL` is set; in-memory fallback per limiter instance.
- Notable limits: admin login (5 per 15 min), contact, reviews, coupon validate, payment endpoints.

### Network and transport

| Control | Detail |
|---------|--------|
| **Cloudflare** | `TRUST_CLOUDFLARE=true` required in production; blocks direct origin access; uses `CF-Connecting-IP` |
| **CORS** | Whitelist `FRONTEND_URL` + localhost dev origins; no-origin allowed in prod only for `/api/health` and webhook |
| **Helmet** | CSP (PayPal domains allowed), HSTS in production, frameguard deny, noSniff, XSS filter |
| **HTTPS** | Production redirect via `x-forwarded-proto`; optional direct SSL via cert env paths |
| **Request timeout** | 15s default (`REQUEST_TIMEOUT_MS`) |
| **Trust proxy** | Enabled for Railway/load balancers |

### Input and data protection

- XSS sanitization via `xss` library (`utils/sanitize.ts`).
- Parameterized SQL only (postgres.js tagged templates).
- Order secrets stripped from API responses (`stripOrderSecrets`).
- DB TLS verification in production (`DB_SSL_CA_PATH`; `rejectUnauthorized` defaults true).
- PayPal order/capture IDs have partial unique indexes to prevent duplicate binding.

### Production environment gates

Backend exits on startup if missing:

- `DATABASE_URL`, `FRONTEND_URL`, `ADMIN_PASSWORD_HASH`, `PAYPAL_WEBHOOK_ID`, `TRUST_CLOUDFLARE=true`, `REDIS_URL`, `SENTRY_DSN`

Frontend build fails in CI/production if missing or invalid:

- `VITE_API_BASE_URL`, `VITE_SITE_URL`, `VITE_SENTRY_DSN` (no localhost or placeholder domains)

Redis connection failure in production prevents server startup.

---

## Logging and monitoring

### Pino (backend)

- JSON structured logs in production; `pino-pretty` in development.
- Log level: `LOG_LEVEL` env or `info` (prod) / `debug` (dev).
- Every request gets a child logger with `X-Request-Id` (UUID).

### Sentry

| Layer | Package | Configuration |
|-------|---------|---------------|
| Backend | `@sentry/node` | `SENTRY_DSN` required in production; optional `SENTRY_RELEASE`; 10% trace sample rate |
| Frontend | `@sentry/react` | `VITE_SENTRY_DSN` required in CI/production builds; browser tracing; optional `VITE_SENTRY_RELEASE` |

- Global Express error handler calls `captureException` with request ID, method, path.
- React `ErrorBoundary` captures render errors.
- Frontend `logError`/`logWarn`: console in dev; Sentry only in production.

### Health check

`GET /api/health` returns:

- Database latency and pool stats
- PayPal mode (sandbox/live)
- Redis connection status
- Uptime

Returns **503** if database is unreachable.

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

Started on server boot and run on intervals (`maintenanceJobs.ts`):

| Job | Interval | Action |
|-----|----------|--------|
| Idempotency cleanup | 1 hour | Delete expired non-processing idempotency rows |
| Stale pending orders | 1 hour | Cancel pending orders older than `PENDING_ORDER_TTL_HOURS` (default 24), restore stock, release coupons |
| Stuck idempotency reaper | 15 min | Mark long-running `processing` idempotency rows as `failed` |

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
| `orders` | Orders — JSONB items/shipping, PayPal IDs, `refunded_amount`, access token hash |
| `customers` | Aggregated customer stats, soft delete |
| `coupons` | Discount rules, scope, validity, usage limits |
| `coupon_usage` | Per-order coupon reservations |
| `contact_messages` | Contact inbox |
| `activity_logs` | Anonymized activity events |
| `admin_sessions` | Admin session tokens |
| `reviews` / `review_votes` | Product reviews and voting |

### Payment tables (runtime migrations at startup)

| Table | Purpose |
|-------|---------|
| `payment_idempotency` | Create/capture deduplication with cached responses |
| `processed_refund_events` | Refund webhook and admin refund deduplication |

### Schema files

- `backend/src/database/schema.sql` — base schema
- `backend/src/database/migration-*.sql` — incremental migrations
- Startup applies: `ensureIdempotencyTable()`, `ensureOrderPaymentSchema()` (refunded_amount, PayPal unique indexes, processed_refund_events)

---

## Complete API endpoints

**Base URL (local):** `http://localhost:5000`  
**Base URL (production):** your Railway/API host (frontend uses `VITE_API_BASE_URL`, typically `https://api.example.com/api`)

**Auth legend**

| Label | Meaning |
|-------|---------|
| Public | No login required |
| CSRF | State-changing methods require `X-CSRF-Token` header + `csrf_token` cookie (SPA uses `/api/csrf-token`) |
| Admin | `admin_session` HttpOnly cookie or legacy `Authorization: Bearer` |
| Order token | Per-order access token via `?token=` query or `X-Order-Access-Token` header |
| PayPal | Webhook signature verification (`PAYPAL_WEBHOOK_ID`) |

Expanded request/response docs: [`documentation/API_DOCUMENTATION.md`](documentation/API_DOCUMENTATION.md)

### Core (`backend/src/server.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/csrf-token` | Public | Issue CSRF cookie + token for SPA |
| GET | `/api/health` | Public | Health check (DB ping); used by Railway |
| POST | `/api/paypal/webhook` | PayPal | PayPal event webhook (raw JSON body) |
| GET | `/api/paypal/test` | Admin | PayPal API connectivity test |
| POST | `/api/paypal/create-payment` | Public + CSRF | Create pending order + PayPal order |
| POST | `/api/paypal/capture-payment/:orderId` | Order token + CSRF | Capture PayPal payment after approval |
| GET | `/api/paypal/checkout-context/:paypalOrderId` | Order token | Resume checkout after PayPal redirect |
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
| POST | `/api/products` | Admin + CSRF | Create product |
| PUT | `/api/products/:id` | Admin + CSRF | Update product |
| DELETE | `/api/products/:id` | Admin + CSRF | Delete product |

### Orders (`/api/orders` — `backend/src/routes/orders.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | — | **410 Gone** — use `POST /api/paypal/create-payment` |
| GET | `/api/orders` | Admin | List all orders (pagination, status filters) |
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
| GET | `/api/reviews/product/:productId` | Public | Approved reviews for a product |
| POST | `/api/reviews` | Public + CSRF | Submit a review |
| POST | `/api/reviews/:id/vote` | Public + CSRF | Helpful/not helpful vote |
| GET | `/api/reviews/check/:productId/:email` | Public | Check if email already reviewed product |
| GET | `/api/reviews` | Admin | List reviews (moderation queue) |
| PATCH | `/api/reviews/:id/status` | Admin + CSRF | Approve/reject review |
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
| POST | `/api/activity/batch` | Public + CSRF | Log batched events |
| GET | `/api/activity/export` | Admin | Export activity logs |
| GET | `/api/activity/logs` | Admin | Query activity logs |
| GET | `/api/activity/stats` | Admin | Aggregated activity stats |

### Admin (`/api/admin` — `backend/src/routes/admin.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/admin/login` | Public + CSRF | Admin login; sets `admin_session` cookie |
| POST | `/api/admin/generate-hash` | Public | Generate bcrypt hash for `ADMIN_PASSWORD_HASH` (setup) |
| POST | `/api/admin/logout` | Admin + CSRF | Logout; clears session |
| GET | `/api/admin/verify` | Admin | Verify current session |
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

**Endpoint count:** 71 routes (69 active + 2 deprecated **410** responses).

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
| `/orders` | `MyOrders` | Order lookup; optional `?orderNumber=` & `?token=` deep link |
| `/payment/success` | `PaymentSuccess` | PayPal return; query params `token`, `PayerID`, `aid` |
| `/payment/cancel` | `Cancel` | PayPal cancel return |

### Admin routes

| URL | Page component | Notes |
|-----|----------------|-------|
| `/admin/login` | `AdminLogin` | Admin sign-in |
| `/adminshivamdashboard` | `AdminDashboard` | Protected; redirects to `/admin/login` if unauthenticated |

**Admin dashboard sections** (same URL, in-app tabs — not separate routes): Analytics, Products, Orders, Messages, Customers.

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
| `PAYPAL_WEBHOOK_ID` | Webhook signature verification |
| `TRUST_CLOUDFLARE` | Must be `true` |
| `REDIS_URL` | Cache and rate limits |
| `SENTRY_DSN` | Error tracking |

### Backend — payment and auth

| Variable | Purpose |
|----------|---------|
| `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` | PayPal API |
| `PAYPAL_MODE` | `sandbox` or `live` |
| `JWT_SECRET` | Admin session signing (32+ chars recommended) |
| `ADMIN_USERNAME` | Admin login username |

### Backend — optional / operational

| Variable | Default | Purpose |
|----------|---------|---------|
| `PENDING_ORDER_TTL_HOURS` | 24 | Abandoned checkout expiry |
| `IDEMPOTENCY_STALE_MINUTES` | 5 | Stuck idempotency reaper |
| `REQUEST_TIMEOUT_MS` | 15000 | HTTP request timeout |
| `LOG_LEVEL` | info/debug | Pino log level |
| `RESEND_API_KEY` | — | Email (required for notifications) |
| `IP_SALT` | — | Activity log IP anonymization |
| `DB_SSL_CA_PATH` | — | TLS CA bundle for production DB |

### Frontend — required at production/CI build

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | API base URL (HTTPS in production) |
| `VITE_SITE_URL` | Canonical site URL for SEO/sitemap |
| `VITE_SENTRY_DSN` | Frontend error tracking |

### Frontend — optional

| Variable | Purpose |
|----------|---------|
| `VITE_BACKEND_URL` | Backend origin for non-API calls |
| `VITE_GA4_MEASUREMENT_ID` | Google Analytics (consent-gated) |
| `VITE_GSC_VERIFICATION` | Search Console verification token |
| `SITEMAP_REQUIRE_PRODUCTS` | Fail build if sitemap has zero products (default true in prod/CI) |

---

## CI/CD and deployment

### GitHub Actions (`.github/workflows/ci.yml`)

| Job | Steps |
|-----|-------|
| backend | `npm ci`, build, test (Vitest) |
| frontend | Requires `PRODUCTION_API_BASE_URL` + `VITE_SENTRY_DSN` secrets; validate-env; build with live sitemap; Playwright E2E smoke |
| sitemap | Requires `PRODUCTION_API_BASE_URL`; generates sitemap with `SITEMAP_REQUIRE_PRODUCTS=true` |
| links | Markdown link checker |

### Keep-alive (`.github/workflows/keep-supabase-alive.yml`)

Cron every 6 days — pings database via `backend/scripts/keep-alive.js` (requires `DATABASE_URL` secret).

### Dependabot

Weekly patch/minor updates for Express, PayPal SDK, React, Sentry, GitHub Actions.

### Deployment pattern

- **Backend:** Railway — `npm run build && npm start`; healthcheck `/api/health`
- **Frontend:** Railway — `npm run build && npm start` (serves `dist/`)
- **DNS:** Cloudflare proxy in front of both services in production
- **Secrets:** GitHub `PRODUCTION_API_BASE_URL`, `VITE_SENTRY_DSN`, `DATABASE_URL`

See [`documentation/DEPLOYMENT.md`](documentation/DEPLOYMENT.md) and [`documentation/CLOUDFLARE_RAILWAY.md`](documentation/CLOUDFLARE_RAILWAY.md).

---

## Local development

```bash
# Backend
cd backend
cp env.template .env    # fill DATABASE_URL, PayPal sandbox creds, etc.
npm install
npm run dev             # http://localhost:5000

# Frontend
cd frontend
cp env.template .env    # VITE_API_BASE_URL=http://localhost:5000/api
npm install
npm run dev             # http://localhost:5173
```

**Strict env validation** is skipped locally unless `CI=true` or `NODE_ENV=production`.

```bash
cd backend && npm test           # Vitest (45 tests)
cd frontend && npm run build     # validate-env + sitemap + tsc + vite
cd frontend && npm run test:e2e  # Playwright smoke
npm run links:check              # from repo root
```

---

## Testing

| Suite | Tool | Coverage |
|-------|------|----------|
| Backend unit/API | Vitest | Checkout validation, security, orders, health, PayPal utils, refund idempotency |
| Frontend E2E | Playwright | Home, products, checkout shell, contact page render |
| Link check | Custom script | Documentation internal links |

API tests mock the database layer (`tests/setup.ts`) for fast isolated runs.

---

## Related documentation

| Document | Topic |
|----------|-------|
| [documentation/QUICK_START.md](documentation/QUICK_START.md) | 10-minute local setup |
| [documentation/API_DOCUMENTATION.md](documentation/API_DOCUMENTATION.md) | Full REST API |
| [documentation/DEPLOYMENT.md](documentation/DEPLOYMENT.md) | Production deploy |
| [documentation/ADMIN_DASHBOARD_GUIDE.md](documentation/ADMIN_DASHBOARD_GUIDE.md) | Admin UI |
| [documentation/PAYPAL_SETUP_GUIDE.md](documentation/PAYPAL_SETUP_GUIDE.md) | PayPal credentials and webhooks |
| [documentation/DATABASE_SETUP.md](documentation/DATABASE_SETUP.md) | Schema and migrations |

**Full index:** [documentation/DOCUMENTATION_INDEX.md](documentation/DOCUMENTATION_INDEX.md)
