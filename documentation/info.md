# Lab Door Customs — Project Reference

**Lab Door Customs** is a full-stack e-commerce application for custom footwear. A React storefront handles browsing, cart, and WhatsApp checkout; an Express API owns pricing, inventory, orders, and admin operations. PostgreSQL (Supabase) is the system of record.

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
8. [Contact](#contact)
9. [Activity and analytics](#activity-and-analytics)
10. [Security](#security)
11. [Logging and monitoring](#logging-and-monitoring)
12. [Server startup and bootstrap](#server-startup-and-bootstrap)
13. [Caching and Redis](#caching-and-redis)
14. [WhatsApp contact](#whatsapp-contact)
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
         │ WhatsApp redirect                       │ postgres.js
         ▼                                       ▼
┌─────────────────┐                     ┌──────────────────┐
│  WhatsApp       │                     │  Supabase        │
│  (customer)     │                     │  PostgreSQL      │
└─────────────────┘                     └────────┬─────────┘
                                                 │
         ┌───────────────────────────────────────┤
         ▼                                       ▼
┌─────────────────┐                     ┌──────────────────┐
│  Redis          │                     │  WhatsApp Cloud  │
│  cache + limits │                     │  API (optional)  │
│                 │                     │  Sentry (errors) │
└─────────────────┘                     └──────────────────┘
```

**Monorepo layout**

| Path | Role |
|------|------|
| `package.json` | Root workspace — `npm run dev`, `build`, `start`, `test` |
| `frontend/` | React 19 SPA — Vite build output consumed by Express |
| `backend/` | Express server — API, static SPA hosting, jobs, cache |
| `Tests/` | Vitest + Playwright |
| `.github/workflows/` | CI, Supabase keep-alive cron |
| `documentation/` | Setup, deploy, and operational guides |
| `scripts/` | `dev.mjs` (parallel dev servers), `link-check.mjs` |

**Local development** runs the Vite dev server (port 5173) and API (port 5000) in parallel via `npm run dev` (`scripts/dev.mjs` + `concurrently`; single `Ctrl+C` stops both). Vite proxies `/api` to the backend.

**Production** builds both packages (`npm run build`) and starts one process (`npm start`) that serves API + static files.

**Order creation rule:** New orders are created only through `POST /api/checkout/place-order`. `POST /api/orders` returns **410 Gone**.

---

## Tech stack

| Layer | Technologies |
|-------|--------------|
| Frontend | React 19, React Router 7, TypeScript, Vite 7, Framer Motion, Sonner, liquid-web |
| Backend | Node.js 20, Express 4, TypeScript, postgres.js, Helmet, compression |
| Payments | WhatsApp order placement (`payment_status=pending` until admin confirms); no online payment processor |
| Database | Supabase PostgreSQL (PgBouncer pooler on port 6543 recommended) |
| Cache | Redis 6 (required in production) + in-memory fallback |
| Customer messaging | WhatsApp (`WHATSAPP_CONTACT_NUMBER`, optional Cloud API) |
| Observability | Pino (structured logs), Sentry (backend + frontend) |
| Testing | Vitest (backend), Playwright (frontend E2E smoke) |
| Deploy | Railway (single service, repo root), Cloudflare (required proxy in production) |

---

## Storefront features

### Pages and routes

| Route | Purpose |
|-------|---------|
| `/` | Home — hero carousel, featured products |
| `/products` | Catalog — filters, server search (`POST /api/products/search`), pagination; supports `?q=` deep links |
| `/product/:id` | Product detail — `:id` = product `public_id` UUID (legacy numeric `products.id` still resolves); size selection required before **Add to Cart**; 360° viewer, JSON-LD, meta tags |
| `/cart` | Shopping cart (localStorage via `CartContext`) |
| `/checkout` | Customer/shipping form, coupon validation, no-refund policy checkbox, **Place Order** → WhatsApp redirect |
| `/payment/success` | Optional confirmation page after WhatsApp redirect (order stored in sessionStorage) |
| `/payment/cancel` | Abandoned checkout — **Checkout Cancelled** page; clears pending order storage; cart preserved |
| `/orders` | Customer order lookup — order ID + checkout email (`POST /api/orders/lookup`); email links pre-fill `?orderId=` |
| `/contact` | Contact form with CSRF-protected POST — WhatsApp contact from `VITE_WHATSAPP_CONTACT_NUMBER` |
| `/about`, `/help` | Static content — About covers custom footwear + WhatsApp checkout; Help summarizes shipping ($25 / free over $200), privacy (`privacy@labdoorcustoms.com`), and store policies |
| `/privacy-policy`, `/terms-of-service`, `/returns-policy`, `/replacement-policy`, `/shipping-policy` | Legal pages — shipping policy matches checkout pricing ($25 flat, free over $200); no-refund / manufacturing-defect replacement policy |
| `/admin` | Redirect — `/admin/login` if unauthenticated, `/adminshivamdashboard` if session valid |
| `/admin/login` | Admin authentication |
| `/adminshivamdashboard` | Protected admin dashboard |

### Search and catalog

- **Server:** paginated product list, filters, single-product fetch, sitemap URL export — cached in Redis when available.
- **Client:** Filters on `/products` (color, price, sort) call `POST /api/products/search`. Optional `?q=` on `/products` still applies a text search without a visible search bar. No full-catalog client download. **No shoe category taxonomy** — products are organized by name, size, and color only. Shoe **size is chosen on product detail / checkout**, not via the products listing filter.

### Cart and pricing display

- Cart state persists in browser localStorage (synced across tabs via `BroadcastChannel`).
- On every cart change, `POST /api/products/validate-cart` re-validates each line against the database (product exists, current price, stock, **required size** `size_system` + `size_value`) and refreshes displayed prices via `REFRESH_PRICES`.
- Product detail **Add to Cart** stays disabled until the shopper picks a size (UK/US/EU system + whole-number value — no half sizes); the same rule is enforced in `CartContext.addToCart` and on the server at validate-cart/checkout.
- Cart page shows validation errors and a **Retry validation** button when network validation fails.
- Server recalculates all totals at checkout; client totals are validated against server pricing before place-order.
- Checkout shows a **toast** when required fields are incomplete before place-order (`Please complete all required fields` + first field hint).
- Place-order sends `X-Idempotency-Key` from `createClientId()` (`frontend/src/lib/clientId.ts`) — uses `crypto.randomUUID()` when available, with an RFC-4122 v4 fallback for **HTTP LAN dev** (phones on `http://192.168.x.x` lack a secure context).
- Checkout syncs customer email to activity batches on field change/blur (when analytics consent is granted), not only on initial page load.

### Form accessibility (storefront + admin)

All visible `<input>`, `<select>`, and `<textarea>` controls include **`id` and `name`** (Chrome DevTools “form field should have id or name”). Labels use **`htmlFor`** matching the control `id`, or the control is wrapped in `<label>`. Icon-only search/filter controls and checkboxes without visible text use **`aria-label`**; visually hidden `<label className="sr-only">` covers search bars that lack a visible label.

**Scope:** checkout (`Checkout.tsx`), contact (`ContactUs.tsx`), order lookup (`MyOrders.tsx`), product search/filters (`ProductSearchBar.tsx`, `ProductFilters.tsx`), and admin dashboard modals/tabs (`AdminDashboard.tsx`, `AdminProductFormModal.tsx`, `AdminCouponsTab.tsx`, `AdminActionDialog.tsx`, `AdminProductSearchPicker.tsx`).

**Regression check:** `node frontend/scripts/audit-form-labels.mjs` from the repo root (expect `count 0`). Manual QA: Chrome DevTools **Issues** tab on `/checkout`, `/contact`, `/orders`, `/products`, and `/admin` — no “form field” or “label associated” warnings. See [`FORMS_QA_CHECKLIST.md`](FORMS_QA_CHECKLIST.md).

### Customer-facing content and pricing

- **Shipping rates** (single source of truth): `frontend/src/utils/pricing.ts` mirrors `backend/src/lib/checkoutPricing.ts` — **$25** flat shipping, **free over $200** merchandise subtotal (before volume/coupon discounts). Used on cart, checkout, Help, and About.
- **`/shipping-policy`** imports the same constants; tracking copy matches **order ID + checkout email** lookup on `/orders`.
- **`/contact`** displays the store WhatsApp number from `frontend/src/lib/whatsappContact.ts` (`VITE_WHATSAPP_CONTACT_NUMBER`).
- **`/payment/cancel`** shows **Checkout Cancelled** (WhatsApp checkout; clears pending order storage, cart preserved).
- **360° placeholder** (no admin MP4): “Product photo — drag to explore” on product detail.

### Mobile layout and scroll

Global CSS in `frontend/src/index.css` (see [MOBILE_RESPONSIVE.md](MOBILE_RESPONSIVE.md)):

- **`html`** is the single vertical scrollport (`overflow-y: auto`); **`body`** uses `height: auto` and `overflow-y: visible` (not fixed `height: 100%`).
- **`#root`** is block layout (not flex) so nested app shells do not trap scroll.
- **`AppShell`** keeps flex column + sticky footer; **`main`** uses `flex: 1 0 auto` so content height drives document scroll.
- **Home** uses `overflow-x: hidden` only (not `overflow: hidden`) so the product carousel below the hero remains reachable.
- **Home product carousel** (`ProductCarousel`): scrolling thumbnail cards use `object-fit: contain` (not `cover`) so shoe photos are not cropped; images are centered on the brand gradient with the product name in a dedicated footer.

---

## Admin dashboard

**URL:** `/adminshivamdashboard` (not under `/admin/*` to reduce scanner noise)

**Authentication:** Username + password → HttpOnly `admin_session` cookie (24-hour session). Primary credentials: `ADMIN_USERNAME` + `ADMIN_PASSWORD_HASH`; optional additional admins via `ADMIN_ADDITIONAL_USERS` JSON. Session tokens are **SHA-256 hashed** before storage in `admin_sessions` (raw token never persisted).

**Tabs and capabilities**

| Tab | Functions |
|-----|-----------|
| Analytics | Period selector (`day` / `week` / `month` / `year` / `all` / **Custom** with IST calendar **From**/**To** + **Apply range**); order/revenue stats, **sales by product**, **inventory snapshot**, low-stock count; **CSV export** only after custom range is applied (matches dashboard); GA4/GSC config status; error state with retry |
| Products | Paginated list (50/page, load more); **low-stock filter**; SKU, reorder point, cost price on create/edit; **inventory movement history** per product; bulk **stock** / **stock_delta** updates; image via **Multer** upload (≤20MB) or URL; optional **360° MP4** |
| Orders | Paginated list (50/page), **server-side search**, filter by status, bulk status updates; order modal: tracking, carrier, tracking URL, **estimated delivery**, notify shipped, status transitions, **mark paid**, **edit customer/shipping** (`PATCH …/customer-details`), **edit line items on unpaid pending orders** (`PATCH …/pending-items`), cancel unpaid pending only |
| Coupons | Preset percentage coupons (5/10/20/25/50%), custom codes with **scope** (`applies_to`: all / product + IDs), **server product search** for product scope, **edit** (description, max uses, expiry, active), activate/deactivate, delete; list **paginated (10/page)** |
| Customers | **Server search + pagination**; **admin notes**; address history; **View History** modal (orders paginated, 10/page); detail view, soft delete / restore, show deleted toggle |
| Settings | **Activity log export** (NDJSON, optional date range); **admin sessions** list + expired-session cleanup; **customer aggregate recompute** |

**API-only admin features** (no dedicated UI tab): none beyond Settings tab operational tools. Customer refunds remain disabled (no-refund store policy).

**Store policy:** All sales final — no refunds. Replacements only for verified manufacturing defects within **30 days of delivery** (`/returns-policy`; `/replacement-policy` is an alias). Checkout requires `policy_accepted: true` on place-order. Shared policy text lives in `backend/src/lib/returnPolicy.ts` and `frontend/src/constants/returnPolicy.ts`. Manufacturing-defect claims: contact via WhatsApp (`WHATSAPP_CONTACT_NUMBER` / `VITE_WHATSAPP_CONTACT_NUMBER`).

---

## Checkout and payments

See also [`WHATSAPP_CHECKOUT_GUIDE.md`](WHATSAPP_CHECKOUT_GUIDE.md).

### Flow overview

```
Customer submits checkout (Place Order)
        │
        ▼
POST /api/checkout/place-order
  • Validate cart (price, stock)
  • Apply coupon (server-side)
  • Claim idempotency key (place_order)
  • Create pending order + decrement stock (single transaction)
  • Reserve coupon usage
  • Build WhatsApp message with order details
        │
        ▼
Browser redirects to wa.me/{phone}?text=...
        │
        ▼
Admin confirms payment → Mark paid in dashboard
  • payment_status=completed, status=processing
  • WhatsApp payment confirmation (Cloud API when configured)
```

### Place order (`POST /api/checkout/place-order`)

1. Requires `policy_accepted: true`.
2. Validates cart lines against the database.
3. Resolves coupon discount with scope rules.
4. Calculates pricing server-side; client `amount` is **required** and must match within $0.01.
5. Claims **place_order** idempotency key (`X-Idempotency-Key` or fingerprint).
6. Atomically inserts pending order (`payment_method=WhatsApp`, `payment_status=pending`, `status=pending`) and decrements stock.
7. Reserves coupon usage when applicable.
8. Returns `orderNumber`, `serverOrderId`, `total`, and `whatsappUrl`. The WhatsApp message **Order ID** line is `serverOrderId` (`orders.id` UUID), not `orderNumber`.
9. On failure after order creation: rolls back pending order and restores stock; if rollback fails returns **503** (idempotency left in progress to block duplicate retries). Stock races return **409** `Insufficient stock`.
10. Storefront sets `ldc_clear_cart_after_order` in sessionStorage before WhatsApp redirect; cart clears on next page load (or `/payment/success`), not before redirect.

**WhatsApp phone:** `WHATSAPP_CONTACT_NUMBER` env var (E.164, e.g. `+919888514572`).

### Admin payment confirmation

Admin marks pending orders paid via `PATCH /api/orders/:id/payment-status` with `payment_id` (reference) and `admin_note`. Sets `payment_status=completed`, `status=processing`, then sends **WhatsApp text** to the customer mobile from checkout (WhatsApp Cloud API when `WHATSAPP_CLOUD_ACCESS_TOKEN` and `WHATSAPP_CLOUD_PHONE_NUMBER_ID` are configured).

### Refunds and replacements

**Customer policy:** No refunds. Manufacturing-defect replacements via WhatsApp contact.

| Path | Auth | Behavior |
|------|------|----------|
| `POST /api/orders/:id/cancel` | Admin | **Pending payment only:** cancel + restore stock + release coupon. Paid orders return **403**. |
| `DELETE /api/orders/:id` | Admin | Delete unpaid order — cancels pending orders first (stock + coupon restore), then deletes row. Completed orders return **409**. |

### Payment idempotency

**Table:** `payment_idempotency`

| Operation | TTL | Key source |
|-----------|-----|------------|
| `place_order` | 30 min | `X-Idempotency-Key` header from checkout (`createClientId()`), or SHA-256 fingerprint (email + items + coupon) when header omitted |

Statuses: `processing`, `completed`, `failed`. Stuck `processing` rows are reaped after `IDEMPOTENCY_STALE_MINUTES` (default 5).

---

## Orders and customers

### Order lifecycle

| `payment_status` | Meaning |
|------------------|---------|
| `pending` | Awaiting payment confirmation (WhatsApp / manual) |
| `completed` | Payment confirmed (admin mark paid) |
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

- Customers track orders on `/orders` with **order ID** (`orders.id` UUID) and **checkout email** — no access tokens are issued or emailed.
- Confirmation and shipping updates are sent via **WhatsApp** (Cloud API when configured) with link to `/orders?orderId={uuid}` (order ID pre-filled; customer enters email on the page).
- Customer lookup: `POST /api/orders/lookup` with `{ orderId, email }` in the JSON body (CSRF-protected).
- Wrong order ID, wrong email, or invalid UUID all return **404** `{ "error": "Order not found" }` (anti-enumeration).
- Tracked orders stay in memory for **auto-refresh** and **Refresh** while the page stays open; a **full browser reload** clears order details and the lookup form (user re-enters order ID + email). Email links still pre-fill `?orderId=` only.
- `GET /api/orders/:id` and `GET /api/orders/number/:orderNumber` are **admin-only**.
- `GET /api/orders/access-exchange/:code` returns **410 Gone** (legacy one-time links removed).
- Public listing of orders by email is blocked (`GET /api/orders/customer/:email` is admin-only).

### Customer aggregates

- `customers` table tracks `total_orders`, `total_spent`, dates — updated when payment is marked **completed**, reversed on full refund, adjusted on partial refund.
- Soft delete supported (`is_deleted` flag).

### Admin order operations

- Update fulfillment status, tracking, carrier, estimated delivery.
- Cancel pending orders (restores stock automatically).
- Cancel **unpaid** pending orders only; paid orders use replacement workflow for manufacturing defects (no admin refund).
- Send shipping notification via WhatsApp (auto on status → shipped when tracking present; admin **Notify shipped**).
- **Mark paid manually** via `PATCH /api/orders/:id/payment-status` with `payment_status: completed`, `admin_note` (≥3 chars), and `payment_id` (external payment reference, ≥5 chars); logged to `activity_logs` as `admin_mark_paid`.
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

- `POST /api/coupons/validate` — public, rate-limited, cached 30s (cache key includes sorted product IDs). Requires cart **`items`** (`product_id`, `quantity`); prices are loaded from the database via the same `computeCheckoutPricingForCart` helper as place-order (volume discount, shipping, coupon scope). Response includes a **`pricing`** breakdown when valid. Checkout compares server `total` to the client total before place-order (blocks on mismatch > $0.01; `amount` is required on place-order).
- Scope enforcement at checkout:
  - `all` — applies to full eligible cart subtotal
  - `product` — only matching `applies_to_ids` product IDs
- Minimum order, max uses, per-customer limits enforced server-side.
- `POST /api/coupons/use` returns **410 Gone** — usage recorded only during place-order reservation.

### Coupon reservation

At place-order, a row in `coupon_usage` reserves the coupon for the pending order. Released automatically on cancel, expiry, or full refund.

---

## Contact

### Contact form

- `POST /api/contact` — rate-limited, CSRF-protected.
- Stores message in `contact_messages` for audit; response may include `whatsappUrl` for optional follow-up chat.
- Storefront `/contact` shows WhatsApp contact from `VITE_WHATSAPP_CONTACT_NUMBER`.
- Successful submit emits `contact_submit` activity event (consent-gated).

---

## Activity and analytics

### Client activity tracking

- Frontend batches page views, cart actions, checkout events (`checkout_start`, `checkout_complete`, `purchase_complete`), size/quantity changes, and **contact submit** to `POST /api/activity/batch` only when analytics cookie consent is granted (`hasAnalyticsConsent()`). Checkout email is stored in `sessionStorage` only when consent is granted (`setUserEmail` on checkout email change/blur); cleared on cookie reject.
- Allowed batch action types: `page_view`, `product_view`, `add_to_cart`, `remove_from_cart`, `checkout_start`, `checkout_complete`, `purchase_complete`, `search`, `filter_apply`, `contact_submit`, `size_select`, `quantity_change`.
- Wired on storefront: `size_select` (product detail), `quantity_change` (cart +/-), `checkout_complete` (before WhatsApp redirect), `purchase_complete` (order placed).
- `POST /api/activity/batch` is **CSRF-exempt** (supports `sendBeacon`) and rate-limited separately; max **20** events per batch. Response includes `inserted` and `skipped` counts; unknown action types are skipped (not persisted). Returns **500** when every valid event in the batch fails to persist. `POST /api/activity/log` returns **500** on database insert failure.
- IP addresses anonymized with daily-salted SHA-256 (`IP_SALT`); stored as `anon_{hash}`.
- `product_view` and `add_to_cart` events can bump product metrics when `canBumpProductMetric()` allows (per-IP per-product rate limit).
- Admin can query logs via API; **export all activity** from the dashboard **Settings** tab (`GET /api/activity/export`).

### Storefront analytics

- **GA4:** loaded only after cookie consent (`VITE_GA4_MEASUREMENT_ID`).
- **Google Search Console:** verification meta tag via `VITE_GSC_VERIFICATION`.
- Admin analytics tab shows GA4/GSC configuration status and links to external dashboards.

---

## Security

### Authentication and authorization

| Actor | Mechanism |
|-------|-----------|
| Admin | Bcrypt password hash (`ADMIN_PASSWORD_HASH` + optional `ADMIN_ADDITIONAL_USERS`); HMAC-signed session token in HttpOnly cookie; **SHA-256 hash** stored in `admin_sessions`; optional `Authorization: Bearer` header |
| Customer orders | Order ID (`orders.id` UUID) + checkout email via `POST /api/orders/lookup` (CSRF); email links use `/orders?orderId=` |

**JWT_SECRET:** used for admin token signing; complexity rules enforced when present (32+ chars, mixed case, number, special character).

### CSRF protection

- Double-submit cookie pattern: `csrf_token` cookie + `X-CSRF-Token` header on mutating requests.
- `GET /api/csrf-token` initializes token for cross-origin API setups (in-memory cache on frontend).
- Frontend `apiFetch` retries once on CSRF 403 after refreshing token.
- Skipped for: GET/HEAD/OPTIONS, `/api/activity/batch`.

### Rate limiting

- Per-route limits via `express-rate-limit`.
- Redis-backed store when `REDIS_URL` is set; in-memory fallback in development only — **production fails closed** if Redis is required but unavailable.
- Notable limits: admin login (5 per 15 min), contact, coupon validate, place-order, order lookup, product search, order access exchange.

### Network and transport

| Control | Detail |
|---------|--------|
| **Cloudflare** | `TRUST_CLOUDFLARE=true` required in production; blocks direct origin access; uses `CF-Connecting-IP` |
| **CORS** | Whitelist `FRONTEND_URL` + localhost dev origins; **non-production:** private LAN IPs (any port) and localhost on ports 5173–5175, 3000, 4173 (Vite fallback when 5173 is busy); no-origin allowed in prod only for `/api/health` |
| **Helmet** | CSP, HSTS in production, frameguard deny, noSniff, XSS filter |
| **compression** | `compression` middleware — gzip/deflate responses **> 1 KB**; honors `x-no-compression`; level 6 |
| **JSON body limit** | `express.json({ limit: '1mb' })` — large admin images use **Multer** multipart, not JSON |
| **HTTPS** | Production redirect via `x-forwarded-proto`; optional direct SSL via cert env paths |
| **Request timeout** | 60s default (`REQUEST_TIMEOUT_MS`); slow routes use 180s (`SLOW_REQUEST_TIMEOUT_MS`): `/api/products*`, `/api/admin/analytics`, `/api/activity/*` |
| **Trust proxy** | Enabled for Railway/load balancers |

### Express middleware stack (order)

Registered in `backend/src/server.ts` (simplified):

1. `requestIdMiddleware` — UUID per request → `X-Request-Id`, child Pino logger on `req.log`
2. HTTPS redirect (production), Cloudflare proxy check
3. **Helmet** — security headers + CSP
4. CORS
5. `compression` middleware
6. `express.json` / `urlencoded`
7. Per-request timeout handler
8. CSRF (`csrfTokenSetter`, `csrfProtection`)
9. **express-rate-limit** — `mountRateLimits()` in `middleware/rateLimits.ts` (global `/api/` + per-route)
10. `requestLogMiddleware` — **HTTP access logging via Pino** (`Request started` / `Request finished`); **not Morgan**
11. API routes + static `/uploads` + SPA fallback

**Morgan:** not used — structured Pino logs replace Apache-style access lines and integrate with Sentry/request IDs.

### Input and data protection

- XSS sanitization via `xss` library (`utils/sanitize.ts`).
- Parameterized SQL only (postgres.js tagged templates).
- Order secrets stripped from API responses (`stripOrderSecrets` removes `access_token_hash` and `access_token_encrypted` — never returned in JSON).
- DB TLS verification in production (`DB_SSL_CA_PATH`; `rejectUnauthorized` defaults true).
- Product images: admin uploads via **`POST /api/admin/uploads/product-media`** (Multer multipart, images ≤20MB, MP4 ≤15MB) → stored under `uploads/products/` and served at `/uploads/products/*`. Create/update accepts HTTPS/relative URLs (max 2048 chars) or legacy JSON `data:image/*` ≤1MB (`lib/productImage.ts`, aligned with `express.json` 1MB limit). Optional **`UPLOAD_DIR`** env overrides storage path.
- Supabase RLS at startup (`ensureRlsPolicies()`): all **10** application tables (including `order_access_exchanges`) use **service_role-only** policies; `anon` and `authenticated` grants are revoked — no public product read via PostgREST/GraphQL; all data access goes through Express. Boot is **non-destructive** when policies already exist (skips DROP/CREATE that caused pooler lock hangs). **Production Supabase:** all required SQL migrations applied (June 2026), including `migration-performance-linter-fixes.sql` (lint 0006 policy consolidation + FK indexes) and `migration-products-search-trgm.sql`.

### Production environment gates

Backend exits on startup if missing (mirrors `backend/scripts/validate-env.mjs`):

- `DATABASE_URL`, `FRONTEND_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_USERNAME`, `JWT_SECRET` (32+ chars), `WHATSAPP_CONTACT_NUMBER`, `TRUST_CLOUDFLARE=true`, `REDIS_URL`, `SENTRY_DSN`, `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`

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
- **DB:** `[withRetry]` logs include operation `label`, Postgres `code`, and pool stats on failure; queries ≥ `DB_SLOW_QUERY_LOG_MS` (default 2s) log as `[DB] slow query`. Hot paths use `query()` (`dbQuery` in routes): products, activity, orders, coupons, contact, admin, and `cacheWarm.ts` on startup.
- **Process errors:** `registerProcessErrorHandlers()` logs `unhandledRejection` and `uncaughtException` without exiting (dev warns; production logs + Sentry). Transient pool blips should not take down the API process.
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

`GET /api/health/detail` (admin) returns database latency, pool stats, Redis status, and uptime.

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
| Admin analytics (`GET /api/admin/analytics`) | 5–15 min (`ADMIN_ANALYTICS_CACHE_TTL_MS`, default 10 min) | TTL expiry (Redis + in-memory) |

### Cache warming

On server startup, preloads product list pages (limits 10 and 20) to reduce cold-start latency.

---

## WhatsApp contact

Store contact number: **`WHATSAPP_CONTACT_NUMBER`** (backend) and **`VITE_WHATSAPP_CONTACT_NUMBER`** (frontend build — must match). Helpers: `backend/src/lib/whatsappContact.ts`, `frontend/src/lib/whatsappContact.ts`. Checkout place-order opens `wa.me` via `whatsappCheckout.ts`.

| Notification | Trigger |
|--------------|---------|
| WhatsApp payment confirmation | After admin marks order paid — outbound text to customer phone via Cloud API (`WHATSAPP_CLOUD_*`) |
| WhatsApp shipping notification | Status → shipped (with tracking) or admin `POST /api/orders/:id/notify-shipped` |
| Contact follow-up | Contact form success may return `whatsappUrl` with prefilled message |

Optional **WhatsApp Cloud API** (`WHATSAPP_CLOUD_ACCESS_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`) sends automated texts to the customer mobile from checkout. Without Cloud API, checkout still redirects to the store WhatsApp number; automated customer texts are skipped with a server log warning.

---

## Maintenance jobs

Started after core bootstrap completes (`maintenanceJobs.ts`). The **initial run** logs each step (`Maintenance: step started` / `step finished`). Scheduled hourly and 15-minute jobs **ping the database first**; if the pooler is unreachable (sleep, Wi‑Fi drop, `CONNECT_TIMEOUT`, `ENOTFOUND`), they log a single compact warning and skip — no stack traces per cleanup task.

| Job | Interval | Action |
|-----|----------|--------|
| **Initial run** | `MAINTENANCE_DEFER_MS` after boot (default 120s) | DB ping → expire stale orders → reap stuck idempotency keys |
| Hourly bundle | 1 hour | Ping → idempotency cleanup → stale orders → **low-stock digest** (log count only; no email) → order line-items backfill → checkout exchange cleanup → order access exchange cleanup |
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
| `products` | Catalog — price, stock, size, color, optional `video_360` (MP4 URL for 360° viewer). Legacy `rating` / `review_count` columns remain in DB (defaults) but are unused after reviews removal. |
| `orders` | Orders — JSONB items/shipping, `payment_id`, `access_token_hash`, `access_token_encrypted` |
| `customers` | Aggregated customer stats, soft delete |
| `coupons` | Discount rules, scope, validity, usage limits |
| `coupon_usage` | Per-order coupon reservations |
| `contact_messages` | Contact form submissions (audit storage) |
| `activity_logs` | Anonymized activity events |
| `admin_sessions` | Admin session token hashes (SHA-256) |

### Payment tables (runtime migrations at startup)

| Table | Purpose |
|-------|---------|
| `payment_idempotency` | Place-order deduplication with cached responses |
| `order_access_exchanges` | One-time order tracking link codes (email) |

### Schema files

- `backend/src/database/schema.sql` — base schema
- `backend/src/database/migration-*.sql` — incremental migrations (run in Supabase SQL editor)
- **Boot applies (skip-if-exists):** `ensureIdempotencyTable()`, `ensureOrderPaymentSchema()`, `ensureOrderAccessExchangeTable()`, `ensureRlsPolicies()`
- `backend/src/database/migration-rls-tighten.sql` — reference SQL for RLS (mirrors boot logic)
- `backend/src/database/migration-performance-linter-fixes.sql` — FK indexes (lint 0001) and consolidated RLS policies (lint 0006). **Applied on production Supabase** (June 2026).
- `backend/src/database/migration-products-search-trgm.sql` — `pg_trgm` + GIN indexes on `products.name` / `products.description` for `POST /api/products/search`. **Applied on production Supabase** (June 2026).
- `backend/src/database/migration-admin-enhancements.sql` — SKU, reorder point, inventory movements, order line items, admin notes. **Applied on production Supabase** (June 2026).
- `backend/src/database/migration-products-video-360.sql` — `products.video_360` for admin 360° MP4 URLs. **Applied on production Supabase** (June 2026).
- `backend/src/database/migration-remove-product-category.sql` — drops `products.category` and `order_line_items.category`; coupon scope limited to `all` / `product`. **Applied on production Supabase** (July 2026).
- `backend/src/database/migration-drop-reviews.sql` — drops `reviews`, `review_votes`, and `update_product_rating()` trigger. **Run in Supabase SQL Editor** when removing the reviews feature from an existing database (see [`SUPABASE_SQL_TO_RUN.md`](SUPABASE_SQL_TO_RUN.md)).
- `backend/src/database/migration-drop-paypal.sql` — legacy payment cleanup (applied on production Supabase, July 2026).
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
| Order lookup | Customer `POST /api/orders/lookup` with `{ orderId, email }` — no access tokens |

Expanded request/response docs: [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md)

### Core (`backend/src/server.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/csrf-token` | Public | Issue CSRF cookie + token for SPA |
| GET | `/api/health` | Public | Minimal health check (DB ping); used by Railway |
| GET | `/api/health/detail` | Admin | Full service diagnostics |

### Checkout (`/api/checkout` — `backend/src/routes/checkout.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/checkout/place-order` | Public + CSRF | Validate cart, create pending order, return `whatsappUrl` |

Any unmatched `/api/*` path returns **404** JSON `{ error: "Route not found" }`.

### Products (`/api/products` — `backend/src/routes/products.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/products` | Public | List products (pagination, filters) |
| GET | `/api/products/filters` | Public | Available filter facets (size, color, price range, sort) |
| GET | `/api/products/sitemap-urls` | Public | Product IDs/paths for sitemap generation |
| GET | `/api/products/:id` | Public | Single product by `public_id` UUID or legacy numeric `id` |
| POST | `/api/products/search` | Public + CSRF | Product search and filters |
| POST | `/api/products/validate-cart` | Public + CSRF | Validate cart lines (price, stock, existence) |
| POST | `/api/products` | Admin + CSRF | Create product |
| PUT | `/api/products/:id` | Admin + CSRF | Update product |
| DELETE | `/api/products/:id` | Admin + CSRF | Delete product |

### Orders (`/api/orders` — `backend/src/routes/orders.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/orders` | — | **410 Gone** — use `POST /api/checkout/place-order` |
| GET | `/api/orders` | Admin | List all orders (pagination, status filters, `?search=` on order id, order number, email, name) |
| GET | `/api/orders/access-exchange/:code` | — | **410 Gone** — use `POST /api/orders/lookup` |
| POST | `/api/orders/lookup` | Public + CSRF | Lookup order by `orderId` + `email` in request body |
| GET | `/api/orders/stats/summary` | Admin | Order/revenue summary stats |
| GET | `/api/orders/number/:orderNumber` | Admin | Lookup by order number |
| GET | `/api/orders/customer/:email` | Admin | Orders for customer email |
| GET | `/api/orders/:id` | Admin | Lookup by order UUID |
| PUT | `/api/orders/:id` | Admin + CSRF | Update order fields |
| PATCH | `/api/orders/:id/status` | Admin + CSRF | Update fulfillment status |
| PATCH | `/api/orders/:id/payment-status` | Admin + CSRF | Update payment status |
| PATCH | `/api/orders/:id/customer-details` | Admin + CSRF | Edit contact/shipping on an order |
| PATCH | `/api/orders/:id/pending-items` | Admin + CSRF | Edit line items on unpaid pending orders (inventory-aware) |
| POST | `/api/orders/:id/cancel` | Admin + CSRF | Cancel order (+ inventory restore) |
| DELETE | `/api/orders/:id` | Admin + CSRF | Delete unpaid order (restores stock/coupon for pending, then deletes) |
| POST | `/api/orders/:id/notify-shipped` | Admin + CSRF | Send shipped notification via WhatsApp |

### Coupons (`/api/coupons` — `backend/src/routes/coupons.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/coupons/validate` | Public + CSRF | Validate coupon code at checkout |
| POST | `/api/coupons/use` | — | **410 Gone** — usage recorded at place-order |
| GET | `/api/coupons` | Admin | List coupons |
| GET | `/api/coupons/:id` | Admin | Single coupon |
| POST | `/api/coupons` | Admin + CSRF | Create coupon |
| PUT | `/api/coupons/:id` | Admin + CSRF | Update coupon |
| PATCH | `/api/coupons/:id/toggle` | Admin + CSRF | Enable/disable coupon |
| DELETE | `/api/coupons/:id` | Admin + CSRF | Delete coupon |
| GET | `/api/coupons/:id/usage` | Admin | Coupon redemption history |

### Contact (`/api/contact` — `backend/src/routes/contact.ts`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/contact` | Public + CSRF | Submit contact form |

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
| GET | `/api/admin/analytics` | Admin | Dashboard analytics; `?period=day\|week\|month\|year\|all\|custom` (+ optional `from`/`to` ISO datetimes, **IST +05:30** for custom); includes `sales` and `inventory`. Preset period boundaries (day/week/month/year) use **Asia/Kolkata** calendar. |
| GET | `/api/admin/analytics/export` | Admin | CSV product sales export; same `period`/`from`/`to` as analytics; custom filenames `product-sales-YYYY-MM-DD_YYYY-MM-DD.csv` (IST dates) |
| GET | `/api/admin/customers` | Admin | Customer list (`?search=&page=&limit=`) |
| GET | `/api/admin/customers/:email` | Admin | Customer detail + order history (`?page=&limit=`; default 20, max 100) |
| PATCH | `/api/admin/customers/:id` | Admin + CSRF | Update name, phone, admin notes |
| POST | `/api/admin/customers/recompute` | Admin + CSRF | Rebuild customer aggregates from completed orders |
| POST | `/api/admin/customers/:id/restore` | Admin + CSRF | Restore soft-deleted customer |
| DELETE | `/api/admin/customers/:id` | Admin + CSRF | Soft-delete customer |
| GET | `/api/admin/products/low-stock` | Admin | Products at/below reorder point |
| GET | `/api/admin/products/:id/inventory-movements` | Admin | Stock movement audit log |
| POST | `/api/admin/products/bulk-update` | Admin + CSRF | Bulk updates: `stock`, `stock_delta`, `is_out_of_stock` |
| POST | `/api/admin/uploads/product-media` | Admin + CSRF | Multipart upload — fields `image`, `background`, `video_360` (images ≤20MB, MP4 ≤15MB); returns URL paths under `/uploads/products/*` |
| PATCH | `/api/orders/:id/customer-details` | Admin + CSRF | Edit order contact/shipping (not paid line totals) |
| PATCH | `/api/orders/:id/pending-items` | Admin + CSRF | Edit line items on unpaid pending orders |
| POST | `/api/admin/orders/bulk-update` | Admin + CSRF | Bulk order status updates |

**Endpoint count:** 57 routes (55 active + 2 deprecated **410** responses: `POST /api/orders`, `POST /api/coupons/use`).

---

## Webpage URLs

**SPA routing:** React Router in `frontend/src/App.tsx` (`BrowserRouter`). Production base URL is `VITE_SITE_URL` (default `https://www.labdoorcustoms.com`). Local dev: `http://localhost:5173`.

### Storefront routes

| URL | Page component | Notes |
|-----|----------------|-------|
| `/` | `Home` | Landing page, carousel, featured products |
| `/products` | `ProductsPage` | Catalog; optional query `?q=` for search |
| `/product/:id` | `ProductDetailPage` | `:id` = `products.public_id` UUID (numeric id supported for legacy links); sitemap uses `public_id` |
| `/about` | `AboutUs` | About page |
| `/contact` | `ContactUs` | Contact form; WhatsApp contact from env |
| `/help` | `HelpCenter` | Help / FAQ (shipping $25 / free over $200) |
| `/privacy-policy` | `PrivacyPolicy` | Privacy policy |
| `/terms-of-service` | `TermsOfService` | Terms of service |
| `/returns-policy` | `ReturnsPolicy` | No-refund / manufacturing-defect replacement policy |
| `/replacement-policy` | `ReturnsPolicy` | Alias for returns policy |
| `/shipping-policy` | `ShippingPolicy` | Shipping policy — matches checkout pricing ($25 / free over $200) |
| `/cart` | `CartPage` | Shopping cart |
| `/checkout` | `Checkout` | Checkout form + WhatsApp place-order |
| `/orders` | `MyOrders` | Order lookup via POST body (`orderId` + email); email links pre-fill `?orderId=` only |
| `/payment/success` | `PaymentSuccess` | Optional return after WhatsApp redirect; shows UUID Order ID + GSS order number from sessionStorage |
| `/payment/cancel` | `Cancel` | **Checkout Cancelled** — clears pending order storage |

### Admin routes

| URL | Page component | Notes |
|-----|----------------|-------|
| `/admin/login` | `AdminLogin` | Admin sign-in |
| `/adminshivamdashboard` | `AdminDashboard` | Protected; redirects to `/admin/login` if unauthenticated |

**Admin dashboard sections** (same URL, in-app tabs — not separate routes): Analytics, Products, Orders, Coupons, Customers, Settings.

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

`/`, `/products`, `/about`, `/contact`, `/help`, `/privacy-policy`, `/terms-of-service`, `/returns-policy`, `/replacement-policy`, `/shipping-policy`, plus dynamic `/product/{id}` entries from `GET /api/products/sitemap-urls` at build time.

### URLs referenced in navigation (not separate routes)

Footer/header links use the routes above. Product search navigates to `/products?q={query}`. Cart badge and checkout flow link `/cart` → `/checkout` → WhatsApp → optional `/payment/success`.

---

## Environment variables

Templates: `backend/env.template`, `frontend/env.template`

### Backend — required in production

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection (pooler port 6543) |
| `FRONTEND_URL` | CORS, CSP |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash for primary admin (`ADMIN_USERNAME`) |
| `ADMIN_USERNAME` | Primary admin login username |
| `ADMIN_ADDITIONAL_USERS` | Optional JSON array of extra admins: `[{"username":"...","passwordHash":"$2b$12$..."}]` |
| `JWT_SECRET` | Admin session signing (32+ chars required) |
| `WHATSAPP_CONTACT_NUMBER` | Store WhatsApp contact (E.164); checkout redirect, support links |
| `TRUST_CLOUDFLARE` | Must be `true` |
| `REDIS_URL` | Cache and rate limits |
| `SENTRY_DSN` | Error tracking |

### Backend — checkout / messaging

| Variable | Purpose |
|----------|---------|
| `WHATSAPP_CONTACT_NUMBER` | Store contact number (required in production) — place-order `wa.me` redirect and support |
| `WHATSAPP_CLOUD_ACCESS_TOKEN` | Meta Graph API token for outbound customer payment/shipping confirmations (optional) |
| `WHATSAPP_CLOUD_PHONE_NUMBER_ID` | WhatsApp Business phone number ID for Cloud API sends (optional) |

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
| `BOOTSTRAP_FORCE_RLS` | — | Drop legacy RLS policies on boot (default off; production migrations complete) |
| `BOOTSTRAP_PING_TIMEOUT_MS` | 20000 | Fail fast if database is unreachable at bootstrap start |
| `REQUEST_TIMEOUT_MS` | 60000 | HTTP request timeout |
| `ADMIN_ANALYTICS_CACHE_TTL_MS` | 600000 (clamped 300000–900000) | Redis/in-memory TTL for `GET /api/admin/analytics` |
| `SLOW_REQUEST_TIMEOUT_MS` | 180000 | Catalog, admin analytics, activity routes |
| `VITE_API_TIMEOUT_MS` | 60000 | Frontend default `apiFetch` timeout |
| `VITE_EXTENDED_API_TIMEOUT_MS` | 180000 | Frontend `slowApiFetch` (catalog, analytics, activity) |
| `LOG_LEVEL` | info/debug | Pino log level |
| `UPLOAD_DIR` | `./uploads` | Admin Multer product media storage root (use a **persistent volume** on Railway) |
| `REQUEST_LOG_SLOW_MS` | 3000 | Warn when a request exceeds this duration |
| `DB_SLOW_QUERY_LOG_MS` | 2000 | Log slow database queries at warn |
| `ORDER_TOKEN_ENCRYPTION_KEY` | — | AES-256-GCM key for order access token encryption (required in production) |
| `IP_SALT` | — | Activity log IP anonymization (required in production) |
| `DB_SSL_CA_PATH` | — | TLS CA bundle for production DB |
| `SERVE_FRONTEND` | — | `false` disables static SPA hosting; auto-enabled in production when `frontend/dist` exists |
| `FRONTEND_DIST_PATH` | `frontend/dist` | Path to built React SPA served by Express |

### Frontend — required at production/CI build

| Variable | Purpose |
|----------|---------|
| `VITE_API_BASE_URL` | API base path or URL — `/api` in production (same origin) |
| `VITE_SITE_URL` | Canonical site URL for SEO/sitemap |
| `VITE_SENTRY_DSN` | Frontend error tracking |
| `VITE_WHATSAPP_CONTACT_NUMBER` | Store WhatsApp contact (must match `WHATSAPP_CONTACT_NUMBER`) |

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

Cron **daily** at 09:00 UTC — read-only `SELECT 1` via `backend/scripts/keep-alive.js` (requires `DATABASE_URL` GitHub secret). See [`SUPABASE_KEEP_ALIVE.md`](SUPABASE_KEEP_ALIVE.md).

### Dependabot

Weekly patch/minor updates for Express, React, Sentry, GitHub Actions.

### Deployment pattern

- **Railway service** at repository root — `npm run build && npm start`; healthcheck `/api/health`
- **DNS:** Cloudflare proxy on the public domain (`www.yourdomain.com`)
- **API path:** `/api` on the same host as the storefront
- **CI secrets:** `PRODUCTION_API_BASE_URL` (sitemap job), `VITE_SENTRY_DSN`, `DATABASE_URL`

See [`PRE_LAUNCH_CHECKLIST.md`](PRE_LAUNCH_CHECKLIST.md) before first production traffic, plus [`DEPLOYMENT.md`](DEPLOYMENT.md) and [`CLOUDFLARE_RAILWAY.md`](CLOUDFLARE_RAILWAY.md).

---

## Performance and assets

- **Build:** `npm run optimize-assets -w frontend` generates WebP variants from the 5 shoe PNGs, 5 background PNGs, and logos; output in `frontend/src/assets/optimized/` and `frontend/src/lib/generatedImageAssets.ts`.
- **Budget:** `npm run build:budget -w frontend` fails CI/local builds if `dist/assets` exceeds limits (see [`PERFORMANCE_BASELINE.md`](PERFORMANCE_BASELINE.md)).
- **Display:** `productImageMaps.ts` + `responsiveImage.ts` provide `srcSet`/`sizes`; Home preloads hero + adjacent backgrounds.
- **Search:** server-side `POST /api/products/search` (no client full-catalog download).

---

## Local development

```bash
# From repository root (monorepo)
cp backend/env.template backend/.env   # DATABASE_URL, WHATSAPP_CONTACT_NUMBER, ADMIN_PASSWORD_HASH, etc.
cp frontend/env.template frontend/.env # VITE_API_BASE_URL=/api (default)
npm install                            # installs frontend + backend workspaces
npm run dev                            # scripts/dev.mjs — API :5000 + Vite :5173 (proxy /api); Ctrl+C once stops both (exit 0)
```

**API-only mode** (no static hosting): `cd backend && npm run dev`

**Production-like single server locally:**

```bash
npm run build
cd backend && SERVE_FRONTEND=true npm start   # http://localhost:5000
```

**Admin password:** generate `ADMIN_PASSWORD_HASH` with `node backend/scripts/generate-admin-hash.mjs "your-password"` (plaintext `ADMIN_PASSWORD` is rejected at startup). Extra admins: add `ADMIN_ADDITIONAL_USERS` JSON (see `backend/env.template`).

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
npm run build                    # frontend (optimize-assets + budget check) + backend
npm run build -w frontend        # includes optimize-assets, sitemap, build:budget
npm run measure:dist -w frontend # dist/assets size report
npm run links:check
```

---

## Testing

| Suite | Tool | Coverage |
|-------|------|----------|
| Backend unit/API | Vitest | **place-order** checkout (validation + WhatsApp integration happy path), WhatsApp message formatting, admin mark-paid, **admin analytics** (401, IST custom range, CSV export), **validate-cart** (empty/invalid/OOS), **products search** edge cases, **stability/concurrency smoke**, coupon scope (`all` / `product`), `computeCheckoutPricingForCart`, payment idempotency, order tokens, process error handlers, RLS table list + grant revoke, order portal URL, activity batch/log, order lookup, **IST date helpers**, **build performance budgets**, sales analytics invalid-date fallback, **checkout client id** (`createClientId` LAN fallback) |
| Frontend E2E / UI | Playwright | Storefront smoke + deep flows, **document scroll** smoke, **responsive pages matrix** (11 phone viewports × all routes, incl. 320px), checkout/contact/admin UI, mobile viewport |

**Total automated tests:** 423 (119 backend unit + 71 API + 233 Playwright UI).

**Viewport overflow audit (optional):** With `frontend` built and preview on port 4173, run `node Tests/scripts/audit-viewport-overflow.mjs` — checks 12 widths × 16 storefront routes for horizontal overflow.

| Link check | Custom script | Documentation internal links |

API and backend unit tests mock Postgres via `Tests/setup.ts`. Checkout/cart tests use **`Tests/fixtures/products.ts`** for DB-shaped product rows and `product_id` values (not hardcoded `1`). Playwright mocks share the same ids through `Tests/frontend/fixtures/mock-data.ts`.

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
| [WHATSAPP_CHECKOUT_GUIDE.md](WHATSAPP_CHECKOUT_GUIDE.md) | WhatsApp checkout and admin payment confirmation |
| [DATABASE_SETUP.md](DATABASE_SETUP.md) | Schema and migrations |
| [SUPABASE_KEEP_ALIVE.md](SUPABASE_KEEP_ALIVE.md) | Daily Supabase read-only ping (GitHub Actions) |
| [PERFORMANCE_BASELINE.md](PERFORMANCE_BASELINE.md) | Bundle budgets, WebP pipeline, before/after metrics |
| [MEDIA_ASSET_GUIDE.md](MEDIA_ASSET_GUIDE.md) | Product and static image conventions |

**Full index:** [DOCUMENTATION_INDEX.md](DOCUMENTATION_INDEX.md)
