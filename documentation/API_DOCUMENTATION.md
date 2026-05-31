# REST API Documentation

**Authoritative reference:** [`../info.md`](../info.md)

Base URL: `{VITE_API_BASE_URL}` (default local: `http://localhost:5000/api`)

All mutating requests require CSRF token (`X-CSRF-Token` header + cookie) except PayPal webhooks.

---

## Authentication

| Actor | Method |
|-------|--------|
| Admin | HttpOnly `admin_session` cookie after `POST /api/admin/login` |
| Customer orders | `X-Order-Access-Token` header or `?token=` / `?aid=` query param |
| Public | No auth (rate-limited) |

---

## Health and CSRF

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | Public | DB latency, pool stats, Redis, PayPal mode, uptime |
| GET | `/csrf-token` | Public | Returns CSRF token for SPA init |

---

## PayPal (server.ts)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/paypal/webhook` | PayPal signature | Webhook handler (raw JSON body) |
| POST | `/paypal/create-payment` | Public + CSRF | Create pending order + PayPal checkout |
| POST | `/paypal/capture-payment/:orderId` | Order token + CSRF | Capture approved payment |
| GET | `/paypal/checkout-context/:paypalOrderId` | Order token | Recover checkout after redirect |
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

### Capture payment body

```json
{
  "serverOrderId": "uuid",
  "accessToken": "64-char hex",
  "couponId": "optional",
  "discount_amount": 0
}
```

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
| POST | `/` | Admin | Create product |
| PUT | `/:id` | Admin | Update product |
| DELETE | `/:id` | Admin | Delete product |

---

## Orders (`/orders`)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/` | — | **410 Gone** — use PayPal checkout |
| GET | `/` | Admin | List orders — `?status=&payment_status=&page=` |
| GET | `/stats/summary` | Admin | Order/revenue statistics |
| GET | `/number/:orderNumber` | Token or admin | Lookup by order number |
| GET | `/customer/:email` | Admin | Customer order history |
| GET | `/:id` | Token or admin | Single order |
| PUT | `/:id` | Admin | Update fulfillment fields (not payment_status) |
| PATCH | `/:id/status` | Admin | Update order status |
| PATCH | `/:id/payment-status` | Admin | Update payment status |
| POST | `/:id/cancel` | Admin | Cancel order (optional PayPal refund) |
| DELETE | `/:id` | Admin | Delete order (blocked if paid) |
| POST | `/:id/notify-shipped` | Admin | Send shipping email |

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
| PUT | `/:id` | Admin | Update coupon |
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
| POST | `/generate-hash` | Public | Generate bcrypt password hash |
| GET | `/sessions` | Admin | List active sessions |
| POST | `/sessions/cleanup` | Admin | Remove expired sessions |
| GET | `/analytics` | Admin | Dashboard analytics |
| GET | `/customers` | Admin | Customer list |
| GET | `/customers/:email` | Admin | Customer detail |
| POST | `/customers/:id/restore` | Admin | Restore soft-deleted customer |
| DELETE | `/customers/:id` | Admin | Soft delete customer |
| POST | `/products/bulk-update` | Admin | Bulk product updates |
| POST | `/orders/bulk-update` | Admin | Bulk order updates |
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

Applied per IP (Redis-backed when configured). Notable limits:

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
