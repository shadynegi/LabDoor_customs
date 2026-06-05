# REST API Documentation

**Authoritative reference:** [`../info.md`](../info.md)

Base URL: `{VITE_API_BASE_URL}` (default local: `http://localhost:5000/api`)

All mutating requests require CSRF token (`X-CSRF-Token` header + cookie) except PayPal webhooks.

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
| POST | `/paypal/capture-payment/:orderId` | Order token + CSRF | Capture approved payment; **409** if PayPal succeeds but order is not `payment_status=completed` |
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
| POST | `/` | Admin | Create product (image/background URL or ≤512KB data URL) |
| PUT | `/:id` | Admin | Update product (same image rules) |
| DELETE | `/:id` | Admin | Delete product |

---

## Orders (`/orders`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | — | **410 Gone** — use PayPal checkout |
| POST | `/lookup` | Public + CSRF | Lookup by `orderNumber` + `accessToken` in JSON body (preferred for customer lookup) |
| GET | `/` | Admin | List orders — `?status=&payment_status=&page=&search=` (`search` matches order number, email, or name) |
| GET | `/stats/summary` | Admin | Order/revenue statistics |
| GET | `/number/:orderNumber` | Token or admin | Lookup by order number (`?token=` or `X-Order-Access-Token` header) |
| GET | `/customer/:email` | Admin | Customer order history |
| GET | `/:id` | Token or admin | Single order |
| PUT | `/:id` | Admin | Update fulfillment fields (not payment_status) |
| PATCH | `/:id/status` | Admin | Update order status |
| PATCH | `/:id/payment-status` | Admin | Update payment status; marking `pending` → `completed` requires `admin_note` (≥3 chars) and logs `admin_mark_paid` |
| POST | `/:id/cancel` | Admin | Cancel order (optional PayPal refund) |
| DELETE | `/:id` | Admin | Delete order (blocked if paid) |
| POST | `/:id/notify-shipped` | Admin | Send shipping email |

### Order lookup body

```json
{
  "orderNumber": "LDC-2026-00001",
  "accessToken": "64-char-hex"
}
```

### Payment status body (manual mark paid)

```json
{
  "payment_status": "completed",
  "admin_note": "Paid via bank transfer — ref #12345"
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
| POST | `/validate` | Public | Validate coupon — `{ code, subtotal, customer_email, items }` |
| POST | `/use` | — | **410 Gone** |
| GET | `/` | Admin | List coupons |
| GET | `/:id` | Admin | Single coupon |
| POST | `/` | Admin | Create coupon |
| PUT | `/:id` | Admin | Update coupon (code, description, discount, `max_uses`, `valid_until`, `is_active`, etc.) |
| PATCH | `/:id/toggle` | Admin | Toggle active |
| DELETE | `/:id` | Admin | Delete coupon |
| GET | `/:id/usage` | Admin | Usage history |

---

## Reviews (`/reviews`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/product/:productId` | Public | Approved reviews for product |
| POST | `/` | Public | Submit review (rate limited) |
| POST | `/:id/vote` | Public | Vote helpful/not helpful |
| GET | `/check/:productId/:email` | Public | Check if user reviewed |
| GET | `/` | Admin | All reviews |
| PATCH | `/:id/status` | Admin | Approve/reject |
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
| POST | `/log` | Public | Log single event |
| POST | `/batch` | Public | Log batch of events |
| GET | `/logs` | Admin | Query logs |
| GET | `/stats` | Admin | Activity statistics |
| GET | `/export` | Admin | Export logs |

---

## Admin (`/admin`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/login` | Public | Admin login (rate limited) |
| POST | `/logout` | Admin | End session |
| GET | `/verify` | Admin | Verify session |
| POST | `/generate-hash` | Public (dev only) | Generate bcrypt hash — **403 in production**; use `backend/scripts/generate-admin-hash.mjs` |
| GET | `/sessions` | Admin | List active sessions |
| POST | `/sessions/cleanup` | Admin | Remove expired sessions |
| GET | `/analytics` | Admin | Dashboard analytics |
| GET | `/customers` | Admin | Customer list |
| GET | `/customers/:email` | Admin | Customer detail |
| POST | `/customers/:id/restore` | Admin | Restore soft-deleted customer |
| DELETE | `/customers/:id` | Admin | Soft delete customer |
| POST | `/products/bulk-update` | Admin | Bulk product updates |
| POST | `/orders/bulk-update` | Admin | Bulk order status updates (`cancelled` rejected — use cancel endpoint) |
| POST | `/messages/bulk-update` | Admin | Bulk message updates |

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

## Rate limits

Applied per IP. Uses Redis when `REDIS_URL` is set; in production, rate limiting fails closed if Redis is required but unavailable. Notable limits:

- Admin login: 5 attempts / 15 minutes
- Contact, reviews, coupon validate: per-route limits
- Payment endpoints: dedicated limiter (webhooks excluded)

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
