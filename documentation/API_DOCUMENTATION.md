# REST API Documentation

**Authoritative reference:** [`info.md`](info.md)

Base URL: `{VITE_API_BASE_URL}` (default local: `http://localhost:5000/api`)

Mutating requests require CSRF token (`X-CSRF-Token` header + cookie) except `POST /activity/batch` (CSRF-exempt for `sendBeacon`; rate-limited).

---

## Authentication

| Actor | Method |
|-------|--------|
| Admin | HttpOnly `admin_session` cookie after `POST /api/admin/login` |
| Customer orders | `POST /api/orders/lookup` with `{ orderId, email }` (CSRF-protected); WhatsApp confirmations link to `/orders?orderId={uuid}` |
| Public | No auth (rate-limited) |

---

## Health and CSRF

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Redirects to `/api/health` |
| GET | `/api/health` | Public | DB latency, pool stats, Redis status, uptime. Returns **503** in production when Redis is required but disconnected. |
| GET | `/csrf-token` | Public | Returns CSRF token for SPA init |

---

## Checkout (`/checkout`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/checkout/place-order` | Public + CSRF | Validate cart, create pending order, return `whatsappUrl` |

### Place order body

```json
{
  "policy_accepted": true,
  "customerInfo": { "fullName", "email", "phone", "address", "city", "state", "zipCode", "country" },
  "items": [{ "product_id", "quantity", "size_system", "size_value" }],
  "coupon_code": "optional",
  "amount": "required client total string (must match server within $0.01)"
}
```

`policy_accepted` must be `true` (customer agrees to no-refund / manufacturing-defect replacement-only policy).

Headers: `X-Idempotency-Key` (optional), `X-CSRF-Token`

**Response:**

```json
{
  "success": true,
  "serverOrderId": "uuid",
  "orderNumber": "GSS-...",
  "total": 123.45,
  "whatsappUrl": "https://wa.me/919888514572?text=..."
}
```

The storefront redirects the browser to `whatsappUrl`. The pre-filled WhatsApp text uses **`Order ID: {serverOrderId}`** (`orders.id` UUID), not `orderNumber`. Order is created with `payment_status=pending`, `status=pending`, `payment_method=WhatsApp`. Admin confirms payment via **Mark paid**.

---

## Products (`/products`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Paginated list (cached) — `?page=&limit=` |
| GET | `/filters` | Public | Price range and sort options |
| GET | `/sitemap-urls` | Public | Product paths for sitemap |
| GET | `/:id` | Public | Single product (cached) |
| POST | `/search` | Public + CSRF | Search/filter — body: `{ query?, minPrice?, maxPrice?, sortBy?, page?, limit? }` (no per-size or color filters) |
| POST | `/validate-cart` | Public + CSRF | Validate cart lines — `{ items: [{ product_id, quantity, size_system, size_value }] }` (size required per line: UK/US/EU + whole-number value from the allowed size list — no half sizes); returns refreshed prices and stock/size errors |
| POST | `/` | Admin | Create product (image/background URL or Multer-uploaded path; optional `video_360`; optional `cost_price`) — **one product per shoe** |
| PUT | `/:id` | Admin | Update product — includes `is_out_of_stock` (admin toggle), `stock` (logged to `inventory_movements`), images, optional `cost_price` |
| DELETE | `/:id` | Admin | Delete product |

**Create/update body (admin):** `name`, `price`, `image` (required on create), optional `description`, `background`, `stock`, `is_out_of_stock`, `video_360`, `cost_price`. No `sku`, `reorder_point`, `size`, or `color` — one product per shoe; storefront assumes all standard sizes.

---

## Orders (`/orders`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | — | **410 Gone** — use `POST /checkout/place-order` |
| POST | `/lookup` | Public + CSRF | Lookup by `orderId` + `email` in JSON body |
| GET | `/access-exchange/:code` | — | **410 Gone** — legacy one-time links removed |
| GET | `/` | Admin | List orders — `?status=&payment_status=&page=&search=` (`search` matches order id UUID, order number, email, or name) |
| GET | `/stats/summary` | Admin | Order/revenue statistics |
| GET | `/number/:orderNumber` | Admin | Lookup by order number |
| GET | `/customer/:email` | Admin | Customer order history |
| GET | `/:id` | Admin | Single order by UUID |
| PUT | `/:id` | Admin | Update fulfillment fields including `estimated_delivery` (not payment_status) |
| PATCH | `/:id/customer-details` | Admin + CSRF | Edit customer name, email, shipping address, admin notes |
| PATCH | `/:id/pending-items` | Admin + CSRF | Edit line items on unpaid pending orders (inventory adjusted; totals recalculated with volume/coupon pricing) |
| PATCH | `/:id/status` | Admin | Update order status |
| PATCH | `/:id/payment-status` | Admin | Mark paid: `admin_note` + `payment_id` (external reference); sends WhatsApp text to customer mobile (Cloud API when configured); logged to activity |
| POST | `/:id/cancel` | Admin | Cancel **unpaid pending** orders only; paid orders return **403** |
| DELETE | `/:id` | Admin | Delete unpaid order — restores stock + releases coupon for pending orders, then deletes row (blocked if paid) |
| POST | `/:id/notify-shipped` | Admin | Send shipping notification via WhatsApp |

### Order lookup body

```json
{
  "orderId": "00000000-0000-0000-0000-000000000001",
  "email": "customer@example.com"
}
```

Wrong order ID, wrong email, or invalid UUID all return **404** `{ "error": "Order not found" }` (anti-enumeration).

### Payment status body (manual mark paid)

```json
{
  "payment_status": "completed",
  "admin_note": "Paid via bank transfer — ref #12345",
  "payment_id": "EXTERNAL_PAYMENT_REFERENCE"
}
```

### Cancel body

```json
{
  "reason": "optional cancellation note"
}
```

Paid orders return **403** (no-refund store policy).

**Order JSON responses** never include `access_token_hash`, `access_token_encrypted`, or plaintext access tokens (`stripOrderSecrets`).

---

## Coupons (`/coupons`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/validate` | Public | Validate coupon — `{ code, customer_email, items: [{ product_id, quantity }] }`; DB-backed pricing via `computeCheckoutPricingForCart`; returns `{ valid, coupon?, discount_amount?, pricing? }` (same rules as place-order) |
| POST | `/use` | — | **410 Gone** |
| GET | `/` | Admin | List coupons |
| GET | `/:id` | Admin | Single coupon |
| POST | `/` | Admin | Create coupon (`applies_to`: `all` \| `product`, optional `applies_to_ids`) |
| PUT | `/:id` | Admin | Update coupon (code, description, discount, `max_uses`, `valid_until`, `is_active`, etc.) |
| PATCH | `/:id/toggle` | Admin | Toggle active |
| DELETE | `/:id` | Admin | Delete coupon |
| GET | `/:id/usage` | Admin | Usage history |

---

## Contact (storefront)

The `/contact` page does **not** call a backend API. Submitting the form opens WhatsApp with a prefilled message to **`VITE_WHATSAPP_CONTACT_NUMBER`** (see [WhatsApp contact](#whatsapp-contact)). The page displays the store address: **415, Sector 78, Mohali, Punjab, India 140308** (display only).

---

## Activity (`/activity`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/log` | Public + CSRF | Log single event |
| POST | `/batch` | Public (CSRF-exempt) | Log up to 20 events per request (rate-limited; frontend consent-gated). Allowed types: `page_view`, `product_view`, `add_to_cart`, `remove_from_cart`, `checkout_start`, `checkout_complete`, `purchase_complete`, `search`, `filter_apply`, `contact_submit`, `size_select`, `quantity_change` |
| GET | `/logs` | Admin | Query logs |
| GET | `/stats` | Admin | Activity statistics |
| GET | `/export` | Admin | Export logs |

---

## Admin (`/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | Public | Admin login (rate limited) |
| POST | `/logout` | Admin | End session |
| GET | `/verify` | Public | Session probe — **200** `{ success, authenticated, admin? }`; successful DB verifies cached **10s** per token hash (see `session-verify-cache.test.ts`) |
| POST | `/generate-hash` | Public (dev only) | Generate bcrypt hash — **403 in production**; use `backend/scripts/generate-admin-hash.mjs` |
| GET | `/sessions` | Admin | List admin sessions (`is_active`, `is_current` for cookie session) |
| POST | `/sessions/cleanup` | Admin + CSRF | Purge expired sessions and excess logins (keeps 5 newest per user) |
| DELETE | `/sessions/:id` | Admin + CSRF | Revoke a session (not the current cookie session) |
| GET | `/analytics` | Admin | Dashboard analytics; `?period=day\|week\|month\|year\|all\|custom` (+ optional `from`/`to` ISO datetimes, **IST +05:30** for custom); preset boundaries use **Asia/Kolkata** |
| GET | `/analytics/export` | Admin | CSV product sales; same query params; custom attachment `product-sales-{from}_{to}.csv` (IST calendar dates) |
| GET | `/customers` | Admin | Customer list (`?search=&page=&limit=`) |
| GET | `/customers/:email` | Admin | Customer detail + paginated orders (`?page=&limit=`) |
| PATCH | `/customers/:id` | Admin + CSRF | Update name, phone, admin notes |
| POST | `/customers/recompute` | Admin + CSRF | Rebuild customer aggregates |
| POST | `/customers/:id/restore` | Admin | Restore soft-deleted customer |
| DELETE | `/customers/:id` | Admin | Soft delete customer |
| GET | `/products/low-stock` | Admin | Products at/below fixed low-stock threshold (5 units) |
| GET | `/products/:id/inventory-movements` | Admin | Stock movement history |
| POST | `/products/bulk-update` | Admin | Bulk updates: `stock`, `stock_delta`, `is_out_of_stock` (max **500** IDs) |
| POST | `/uploads/product-media` | Admin + CSRF | Multipart upload — fields `image`, `background`, `video_360` (images ≤20MB, MP4 ≤15MB); returns `{ image?, background?, video_360? }` URL paths |
| POST | `/orders/bulk-update` | Admin | Bulk order **status** only (max **500** IDs; validates transitions; `cancelled` and `payment_status` rejected) |

---

## Response format

Success:

```json
{ "success": true, "data": { ... } }
```

Error:

```json
{ "success": false, "error": "message", "message": "details" }
```

---

## Storefront integration notes

How the React SPA uses these APIs (see also [`info.md`](info.md)):

| Flow | Frontend behavior |
|------|-------------------|
| Cart | `POST /products/validate-cart` on cart changes; **Retry validation** on network failure — API tests: `Tests/integration/api/checkout/validate-cart.test.ts` |
| Checkout | `setUserEmail` on email change/blur (consent-gated); `POST /checkout/place-order`; redirect to `whatsappUrl`; optional `/payment/success` reads `lastPlacedOrder` from sessionStorage (shows UUID as Order ID) |
| Orders | WhatsApp/confirmation links pre-fill `?orderId=` on `/orders`; customer enters checkout email; `POST /orders/lookup`; order details clear on full page reload (re-enter ID + email); in-session auto/manual refresh while page stays open; legacy `GET /orders/access-exchange/:code` returns **410** |
| Contact | Client-side `wa.me` from `ContactUs.tsx` + `contact_submit` activity when consented |
| Admin | Products 50/page load-more; per-row **out-of-stock toggle** (`PUT /api/products/:id`); **Multer** media upload (`POST /admin/uploads/product-media`, max **20 MB** images); coupons `applies_to` on create **and edit**; `estimated_delivery` on order PUT; **Settings** tab: activity export, sessions, customer recompute |

---

## Rate limits

Applied per IP. Uses Redis when `REDIS_URL` is set; in production, rate limiting fails closed if Redis is required but unavailable. Notable limits:

- Admin login: 5 attempts / 15 minutes
- Contact, coupon validate: per-route limits
- Checkout place-order, order lookup (`POST /orders/lookup`), product search (`POST /products/search`)
- Place-order returns **409** when stock is insufficient after validation; **503** when rollback fails after a partial create

---

## Pagination

List endpoints return:

```json
{
  "success": true,
  "data": [...],
  "pagination": { "page", "limit", "total", "totalPages" }
}
```
