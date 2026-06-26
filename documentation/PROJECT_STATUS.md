# Project Status — Current Capabilities

**Authoritative reference:** [`info.md`](info.md)

This document describes what the Lab Door Customs platform currently supports.

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on **14** sensitive tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; no-refund policy checkbox; PayPal `?code=` exchange; capture **409** shows processing UI (polls checkout-context; cart held); checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | `/admin` entry redirect; LAN dev CORS (private IP + Vite fallback ports); products paginated (load more); optional **360° MP4**; coupons **10/page**; reviews admin response; estimated delivery on orders; tab error/retry states; **Customers** card layout on mobile; **inventory** (SKU, reorder point, cost, movement history, low-stock alerts, bulk stock delta); **customer admin notes** + server search/pagination; **customer history modal** (orders 10/page); **sales analytics** by period with **IST custom calendar range** (Apply before export) + CSV export; **order customer-details** + pending-item edits. **No Messages tab** (contact API/storage unchanged). |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation success copy; vote error toasts; admin `admin_response` editable. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Storefront

- Product catalog with filters, pagination, and **server-side search** (`POST /api/products/search`, **10 results** per search request, `pg_trgm` on Supabase); Home/Products suggestions debounced to same API
- Optimized storefront assets: WebP variants + responsive `srcSet` for 5 shoe images, 5 backgrounds, and logos; build size budgets (`PERFORMANCE_BASELINE.md`)
- Product detail pages with 360° viewer (admin-uploaded MP4 or spin placeholder), reviews, and structured data
- Shopping cart (localStorage) with server price validation on each change and **retry** on validation failure
- PayPal checkout with server-side pricing; capture **fail-closed** on missing amount; coupon validation
- Payment success page: redeems checkout exchange `?code=`, captures payment; handles **409** reconciliation UI; surfaces expired exchange errors; strips sensitive params from URL on success
- Customer order lookup at `/orders` via `POST /api/orders/lookup`
- Contact form; legal pages including no-refund / manufacturing-defect replacement policy (`/returns-policy`, `/replacement-policy`); cookie consent; GA4 and activity tracking (consent-gated)
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

- Secure login with HttpOnly session cookie (SHA-256 hashed server-side); **`/admin`** redirects to login or dashboard
- Dashboard: analytics (period selector incl. **custom calendar range**, sales by product, inventory snapshot, CSV export), products, orders, coupons (**10/page**), customers, **reviews**
- Orders: server-side search, pagination, fulfillment modal, bulk status (max 500 IDs, validated transitions), manual mark paid (`admin_note` + `payment_id`, logged to activity); edit customer/shipping on pending orders; adjust line items on unpaid pending orders
- Coupons: presets, custom create with **applies_to** scope, edit modal, activate/deactivate, delete; **paginated list (10/page)**
- Products: paginated admin list (50/page, load more), error/retry UI; **Multer file upload** (20 MB images, 15 MB MP4 via `POST /api/admin/uploads/product-media`) or hosted URL; SKU, reorder point, cost price; inventory movement history; low-stock filter; bulk stock / stock-delta updates
- Product CRUD and bulk stock updates
- Customer list with server search/pagination, admin notes, address history; soft delete/restore and **order history modal (10 orders/page)**; `PATCH /admin/customers/:id`
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
- CI: backend validate-env + tests, frontend build with env validation + asset budget, E2E smoke, sitemap gate

---

## Security

- CSRF double-submit with frontend retry on 403
- Rate limiting (Redis-backed in production) via **express-rate-limit**
- Response **compression** (gzip, > 1 KB)
- HTTP access logging via **Pino** (`requestLogMiddleware`) — not Morgan
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

- **233 automated tests** (113 backend unit + 75 API + 45 Playwright UI)
- Playwright storefront smoke + deep flows, **admin analytics custom range**, **responsive mobile UI**, checkout payment flows (serial project), documentation link checker in CI

See [`test_guidelines.md`](test_guidelines.md) for the full inventory and run commands.
