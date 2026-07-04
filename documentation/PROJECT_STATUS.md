# Project Status — Current Capabilities

**Authoritative reference:** [`info.md`](info.md)

This document describes what the Lab Door Customs platform currently supports.

---

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on **10** sensitive tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; no-refund policy checkbox; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | Email links pre-fill `?orderId=` on `/orders`; customer lookup via order ID + checkout email (`POST /api/orders/lookup`); partial refresh keeps stale data + warning. |
| **Admin** | `/admin` entry redirect; LAN dev CORS (private IP + Vite fallback ports); products paginated (load more); optional **360° MP4**; coupons **10/page**; estimated delivery on orders; tab error/retry states; **Customers** card layout on mobile; **inventory** (SKU, reorder point, cost, movement history, low-stock alerts, bulk stock delta); **customer admin notes** + server search/pagination; **customer history modal** (orders 10/page); **sales analytics** by period with **IST custom calendar range** (Apply before export) + CSV export; **order search** by id UUID, order number, email, name; **order customer-details** + pending-item edits; **Settings** tab (activity export, admin sessions, customer recompute). |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA + `.cart-mobile-sticky-spacer` (policy above bar); whole-number shoe sizes only; **document scroll** via single `html` scrollport (`index.css`); Playwright **responsive-pages-ui** (11 phone viewports incl. 320px); OOS hides product sticky bar; admin product cards on phones; `100dvh` + safe-area insets. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Storefront

- Product catalog with filters (color, price, sort — no shoe categories), pagination, and **server-side search** (`POST /api/products/search`, **10 results** per search request, `pg_trgm` on Supabase); optional `?q=` on `/products` applies text search — **no search bar on Home or Products**
- Optimized storefront assets: WebP variants + responsive `srcSet` for 5 shoe images, 5 backgrounds, and logos; build size budgets (`PERFORMANCE_BASELINE.md`)
- Product detail pages with 360° viewer (admin-uploaded MP4 or spin placeholder) and structured data
- Shopping cart (localStorage) with server price validation on each change and **retry** on validation failure
- WhatsApp checkout with server-side pricing; coupon validation; **Place Order** button (no online payment processor)
- Optional `/payment/success` confirmation page (reads `lastPlacedOrder` from sessionStorage)
- Customer order lookup at `/orders` via `POST /api/orders/lookup`
- Contact form (WhatsApp contact from env); legal pages including no-refund / manufacturing-defect replacement policy (`/returns-policy`, `/replacement-policy`); **shipping policy aligned with checkout** ($25 / free over $200); cookie consent; GA4 and activity tracking (consent-gated)
- **`/payment/cancel`** — Checkout Cancelled page (clears pending order storage)
- Mobile sticky CTAs, checkout keyboard offset, responsive layouts, cart policy clearance, **document scroll on all tall pages** — see [MOBILE_RESPONSIVE.md](./MOBILE_RESPONSIVE.md)
- **Form accessibility** — storefront and admin controls have `id`/`name`, associated labels (`htmlFor` or `aria-label`); verified via `frontend/scripts/audit-form-labels.mjs` and [FORMS_QA_CHECKLIST.md](./FORMS_QA_CHECKLIST.md)

---

## Payments and orders

- `POST /api/checkout/place-order` with atomic order + stock reservation; returns `orderNumber`, `serverOrderId`, `total`, `whatsappUrl`
- Pre-filled WhatsApp message includes **Order ID** (`orders.id` UUID), customer/shipping details, line items, and totals — not the `GSS-...` order number
- Orders created with `payment_status=pending`, `status=pending`, `payment_method=WhatsApp`
- Admin **Mark paid** with payment reference + admin note → `payment_status=completed`, `status=processing`; WhatsApp text to customer mobile (Cloud API when configured)
- **No-refund store policy** — checkout requires `policy_accepted: true`; admin refund/cancel of paid orders returns **403**
- Abandoned pending order cleanup (configurable TTL via `PENDING_ORDER_TTL_HOURS`)
- Place-order idempotency via `payment_idempotency` table; checkout sends `X-Idempotency-Key` from `createClientId()` (works on HTTP LAN dev)

See [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md).

---

## Admin

- Secure login with HttpOnly session cookie (SHA-256 hashed server-side); **`/admin`** redirects to login or dashboard
- Dashboard: analytics (period selector incl. **custom calendar range**, sales by product, inventory snapshot, CSV export), products, orders, coupons (**10/page**), customers, **Settings**
- Orders: server-side search, pagination, fulfillment modal, bulk status (max 500 IDs, validated transitions), manual mark paid (`admin_note` + `payment_id`, logged to activity); edit customer/shipping on pending orders; adjust line items on unpaid pending orders
- Coupons: presets, custom create with **applies_to** scope (`all` or specific product IDs), edit modal, activate/deactivate, delete; **paginated list (10/page)**
- Products: paginated admin list (50/page, load more), error/retry UI; **Multer file upload** (20 MB images, 15 MB MP4 via `POST /api/admin/uploads/product-media`) or hosted URL; SKU, reorder point, cost price; inventory movement history; low-stock filter; bulk stock / stock-delta updates
- Product CRUD and bulk stock updates
- Customer list with server search/pagination, admin notes, address history; soft delete/restore and **order history modal (10 orders/page)**; `PATCH /admin/customers/:id`
---

## Infrastructure

- **Monorepo** — npm workspaces (`frontend`, `backend`); root `npm run dev|build|start|test` (`dev` via `scripts/dev.mjs`)
- **Single-server** — Express serves `/api/*` and `frontend/dist` on one Railway service
- Redis required in production (cache + rate limits; fail closed when unavailable)
- Pino structured logging with request IDs — `Request started` / `Request finished`, slow-request warnings, DB retry labels, maintenance step timing
- Sentry required in production (backend + frontend build)
- Health endpoint (`/api/health`) with DB and Redis (503 if required but down)
- Maintenance jobs: idempotency cleanup (batched), stale order expiry, stuck key reaper (`SKIP LOCKED`), legacy checkout/access exchange cleanup; deferred initial run
- CI: backend validate-env + tests, frontend build with env validation + asset budget, E2E smoke, sitemap gate

---

## Security

- CSRF double-submit with frontend retry on 403
- Rate limiting (Redis-backed in production) via **express-rate-limit**
- Response **compression** (gzip, > 1 KB)
- HTTP access logging via **Pino** (`requestLogMiddleware`) — not Morgan
- Cloudflare proxy enforcement in production
- Helmet CSP/HSTS, CORS whitelist, request timeouts
- Customer order lookup by order ID (UUID) + checkout email; anti-enumeration uniform 404
- Post-payment WhatsApp confirmation (Cloud API when configured) on admin mark paid; shipping notifications via WhatsApp
- Admin session tokens stored as SHA-256 hashes
- Production environment validation at startup and build time

---

## SEO

- Build-time sitemap and robots.txt with live product URLs
- Meta tags, canonical URLs, JSON-LD on products
- Google Search Console verification support

---

## Testing

- **423 automated tests** (119 backend unit + 71 API + 233 Playwright UI)
- Playwright storefront smoke + deep flows, **shipping policy / contact WhatsApp / document scroll** smoke, **responsive pages matrix** (`responsive-pages-ui.spec.ts` — 11 phone viewports × all routes, incl. 320px), **admin analytics custom range**, **responsive mobile UI**, checkout/contact/admin UI

See [`test_guidelines.md`](test_guidelines.md) for the full inventory and run commands.
