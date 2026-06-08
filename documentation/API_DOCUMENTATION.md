# REST API Documentation

**Authoritative reference:** [`info.md`](info.md)

Base URL: `{VITE_API_BASE_URL}` (default local: `http://localhost:5000/api`)

Mutating requests require CSRF token (`X-CSRF-Token` header + cookie) except PayPal webhooks and `POST /activity/batch` (CSRF-exempt for `sendBeacon`; rate-limited).

---

## Authentication

| Actor | Method |
|-------|--------|
| Admin | HttpOnly `admin_session` cookie after `POST /api/admin/login` |
| Customer orders | `X-Order-Access-Token` header; PayPal return uses one-time `?code=` exchanged via `/paypal/checkout-exchange/:code`; alternate recovery via `?aid=` |
| Public | No auth (rate-limited) |

---

## Health and CSRF

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | Redirects to `/api/health` |
| GET | `/api/health` | Public | DB latency, pool stats, Redis status, PayPal mode, uptime. Returns **503** in production when Redis is required but disconnected. |
| GET | `/csrf-token` | Public | Returns CSRF token for SPA init |

---

## PayPal (server.ts)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/paypal/webhook` | PayPal signature | Webhook handler (raw JSON body) |
| POST | `/paypal/create-payment` | Public + CSRF | Create pending order + PayPal checkout |
| POST | `/paypal/capture-payment/:orderId` | Order token + CSRF | Capture approved payment; **409** if PayPal succeeds but order is not `payment_status=completed` (storefront shows processing UI, polls checkout-context, does not clear cart) |
| GET | `/paypal/checkout-exchange/:code` | Public | Atomically redeem one-time checkout code → `accessToken` |
| GET | `/paypal/checkout-context/:paypalOrderId` | Order token | Checkout recovery when exchange code is unavailable |
| POST | `/paypal/refund/:captureId` | Admin | Refund capture (partial or full) |
| GET | `/paypal/test` | Admin | PayPal connectivity test |
| GET | `/paypal/order/:orderId` | Admin | Fetch PayPal order details |

### Create payment body

```json
{
  "customerInfo": { "fullName", "email", "phone", "address", "city", "state", "zipCode", "country" },
  "items": [{ "product_id", "quantity", "size_system", "size_value" }],
  "coupon_code": "optional",
  "amount": "optional client total for validation"
}
```

Headers: `X-Idempotency-Key` (optional), `X-CSRF-Token`

**Response:** PayPal approval links and `serverOrderId`. The order access token is **not** returned — the customer redeems a one-time checkout exchange code on the payment success page.

**PayPal return URL:** `{FRONTEND_URL}/payment/success?code={exchangeCode}` — PayPal appends `&token={paypalOrderId}`.

### Checkout exchange

`GET /paypal/checkout-exchange/:code` redeems the `code` from the PayPal return URL. Each code is single-use, expires in 30 minutes, and is stored hashed in `order_checkout_exchanges`. The associated access token is encrypted at rest (AES-256-GCM). A successful redeem returns `accessToken`, `serverOrderId`, order totals, and coupon context.

### Capture payment body

```json
{
  "serverOrderId": "uuid",
  "accessToken": "64-char hex",
  "couponId": "optional",
  "discount_amount": 0
}
```

Headers: `X-Idempotency-Key` (PayPal order ID or client key), `X-CSRF-Token`

### PayPal webhooks

`POST /paypal/webhook` uses a raw JSON body parser (registered before `express.json()`). Signatures are verified via PayPal API when `PAYPAL_WEBHOOK_ID` is set.

| Event | Behavior |
|-------|----------|
| `PAYMENT.CAPTURE.COMPLETED` | Resolve capture amount from payload or PayPal API; complete order with amount validation; auto-refund on mismatch. Returns **500** when order binding or capture application fails (PayPal retries). |
| `PAYMENT.CAPTURE.DENIED` | Cancel pending order, restore stock |
| `PAYMENT.CAPTURE.REFUNDED` / `REVERSED` | Sync refund to DB with deduplication |

---

## Products (`/products`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/` | Public | Paginated list (cached) — `?page=&limit=` |
| GET | `/filters` | Public | Available filter values |
| GET | `/sitemap-urls` | Public | Product paths for sitemap |
| GET | `/category/:category` | Public | Products by category name |
| GET | `/:id` | Public | Single product (cached) |
| POST | `/search` | Public | Search products |
| POST | `/validate-cart` | Public + CSRF | Validate cart lines — `{ items: [{ product_id, quantity, size_system?, size_value? }] }`; returns refreshed prices and stock errors |
| POST | `/` | Admin | Create product (image/background URL or ≤512KB data URL) |
| PUT | `/:id` | Admin | Update product (same image rules) |
| DELETE | `/:id` | Admin | Delete product |

---

## Orders (`/orders`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | — | **410 Gone** — use PayPal checkout |
| POST | `/lookup` | Public + CSRF | Lookup by `orderNumber` + `accessToken` in JSON body |
| GET | `/access-exchange/:code` | Public | Redeem one-time email tracking link → `{ orderNumber, accessToken, serverOrderId }` |
| GET | `/` | Admin | List orders — `?status=&payment_status=&page=&search=` (`search` matches order number, email, or name) |
| GET | `/stats/summary` | Admin | Order/revenue statistics |
| GET | `/number/:orderNumber` | Token or admin | Lookup by order number (`X-Order-Access-Token` header or legacy `?aid=` query) |
| GET | `/customer/:email` | Admin | Customer order history |
| GET | `/:id` | Token or admin | Single order |
| PUT | `/:id` | Admin | Update fulfillment fields including `estimated_delivery` (not payment_status) |
| PATCH | `/:id/status` | Admin | Update order status |
| PATCH | `/:id/payment-status` | Admin | Mark paid: `admin_note` + `payment_id`; **PayPal capture verified** via API before update |
| POST | `/:id/cancel` | Admin | Cancel order; **paid orders require refund** (`process_refund: true`) |
| DELETE | `/:id` | Admin | Delete order (blocked if paid) |
| POST | `/:id/notify-shipped` | Admin | Send shipping email |

### Order lookup body

```json
{
  "orderNumber": "LDC-2026-00001",
  "accessToken": "64-char-hex"
}
```

Wrong order number, missing token, or invalid token all return **404** `{ "error": "Order not found or invalid credentials" }` (anti-enumeration).

### Payment status body (manual mark paid)

```json
{
  "payment_status": "completed",
  "admin_note": "Paid via bank transfer — ref #12345",
  "payment_id": "CAPTURE_OR_EXTERNAL_REF_ID"
}
```

### Cancel body

```json
{
  "reason": "optional",
  "process_refund": true
}
```

---

## Coupons (`/coupons`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/validate` | Public | Validate coupon — `{ code, customer_email, items: [{ product_id, quantity }] }`; DB-backed pricing via `computeCheckoutPricingForCart`; returns `{ valid, coupon?, discount_amount?, pricing? }` (same rules as create-payment) |
| POST | `/use` | — | **410 Gone** |
| GET | `/` | Admin | List coupons |
| GET | `/:id` | Admin | Single coupon |
| POST | `/` | Admin | Create coupon (`applies_to`: `all` \| `product` \| `category`, optional `applies_to_ids`) |
| PUT | `/:id` | Admin | Update coupon (code, description, discount, `max_uses`, `valid_until`, `is_active`, etc.) |
| PATCH | `/:id/toggle` | Admin | Toggle active |
| DELETE | `/:id` | Admin | Delete coupon |
| GET | `/:id/usage` | Admin | Usage history |

---

## Reviews (`/reviews`)

Public list/submit/vote responses use `toPublicReview()` — **`customer_email`, `order_id`, and `status` are never returned** to the storefront. Admin routes return full rows including `customer_email`.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/product/:productId` | Public | Approved reviews (PII stripped) |
| POST | `/` | Public | Submit review — always `pending`; response PII stripped |
| POST | `/:id/vote` | Public + CSRF | Vote on **approved** reviews only (rate-limited; voter ID derived server-side from IP) |
| POST | `/check` | Public + CSRF | Body: `{ product_id, email }` → `{ can_review, message }` — called from storefront ReviewForm on email blur |
| GET | `/` | Admin | All reviews **including `customer_email`** |
| POST | `/admin` | Admin + CSRF | Create review |
| PATCH | `/:id` | Admin + CSRF | Edit fields or approve/reject |
| DELETE | `/:id` | Admin | Delete review |

---

## Contact (`/contact`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | Public | Submit contact form |
| GET | `/` | Admin | List messages |
| GET | `/stats/summary` | Admin | Message statistics |
| GET | `/:id` | Admin | Single message |
| PATCH | `/:id/status` | Admin | Update status |
| DELETE | `/:id` | Admin | Delete message |

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
| GET | `/verify` | Public | Session probe — **200** `{ success, authenticated, admin? }` |
| POST | `/generate-hash` | Public (dev only) | Generate bcrypt hash — **403 in production**; use `backend/scripts/generate-admin-hash.mjs` |
| GET | `/sessions` | Admin | List active sessions |
| POST | `/sessions/cleanup` | Admin | Remove expired sessions |
| GET | `/analytics` | Admin | Dashboard analytics |
| GET | `/customers` | Admin | Customer list |
| GET | `/customers/:email` | Admin | Customer detail |
| POST | `/customers/:id/restore` | Admin | Restore soft-deleted customer |
| DELETE | `/customers/:id` | Admin | Soft delete customer |
| POST | `/products/bulk-update` | Admin | Bulk product updates (max **500** IDs) |
| POST | `/orders/bulk-update` | Admin | Bulk order **status** only (max **500** IDs; validates transitions; `cancelled` and `payment_status` rejected) |
| POST | `/messages/bulk-update` | Admin | Bulk message updates (max **500** IDs) |

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
| Cart | `POST /products/validate-cart` on cart changes; **Retry validation** on network failure |
| Checkout | `setUserEmail` on email change/blur (consent-gated); `POST /paypal/create-payment` with idempotency key |
| Payment success | Redeem `GET /paypal/checkout-exchange/:code`; capture with `serverOrderId` + `accessToken`; **409** → processing UI + poll `GET /paypal/checkout-context/:paypalOrderId` (cart not cleared) |
| Orders | `GET /orders/access-exchange/:code` for email links; `POST /orders/lookup` for manual entry; legacy `?orderNumber=&token=` stripped |
| Reviews | `POST /reviews/check` on email blur; submit shows pending-moderation copy; vote errors via toast |
| Contact | `POST /contact` + `contact_submit` activity when consented |
| Admin | Products 50/page load-more; messages mark read on open (`PATCH /contact/:id/status`); coupons `applies_to` on create **and edit**; product image upload max **512 KB**; `admin_response` on review edit; `estimated_delivery` on order PUT |

---

## Rate limits

Applied per IP. Uses Redis when `REDIS_URL` is set; in production, rate limiting fails closed if Redis is required but unavailable. Notable limits:

- Admin login: 5 attempts / 15 minutes
- Contact, reviews (submit/vote/admin), coupon validate: per-route limits
- Payment endpoints: dedicated limiter (webhooks excluded)
- Order lookup (`POST /orders/lookup`), product search (`POST /products/search`), checkout exchange redeem (`GET /paypal/checkout-exchange/:code`), review eligibility check

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
