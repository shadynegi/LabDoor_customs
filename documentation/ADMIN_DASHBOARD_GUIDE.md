# Admin Dashboard Guide

How to use the Lab Door Customs admin dashboard.

**Full reference:** [`../info.md`](../info.md)

---

## Access

| Item | Value |
|------|-------|
| Login URL | `/admin/login` |
| Dashboard URL | `/adminshivamdashboard` |
| Session | HttpOnly cookie, 24 hours |

Login with admin username and password. Sessions are stored server-side in `admin_sessions`.

Generate a production password hash via `POST /api/admin/generate-hash` and set `ADMIN_PASSWORD_HASH` on the backend.

---

## Analytics tab

Displays:

- Order counts and revenue (completed vs pending)
- Product metrics (views, cart adds)
- Customer statistics
- Geographic breakdown from activity logs
- GA4 and Google Search Console configuration status with external dashboard links

Data source: `GET /api/admin/analytics`

---

## Products tab

- View all products with stock and status
- Create new products (name, price, images, category, size, color, stock)
- Edit existing products
- Delete products
- Bulk update stock / out-of-stock flags via `POST /api/admin/products/bulk-update`

Product list API responses are cached (60s TTL); writes invalidate cache.

---

## Orders tab

### View and filter

Filter by order status and payment status. Paginated list from `GET /api/orders`.

### Update fulfillment

- Set order status: pending → processing → shipped → delivered
- Add tracking number, carrier, tracking URL, estimated delivery
- Send shipping notification email (`POST /api/orders/:id/notify-shipped`)

### Cancel orders

**Pending orders:** Cancels and restores inventory automatically.

**Completed orders with refund:**

1. Set `process_refund: true` in cancel request.
2. Backend refunds remaining balance via PayPal.
3. Order marked refunded, inventory restored, customer stats reversed.

If PayPal refund succeeds but DB sync fails, the API returns 502 — reconcile manually in PayPal dashboard.

### Payment status

`PATCH /api/orders/:id/payment-status` allows admin corrections. Use cancel/refund flows for completed orders.

---

## Messages tab

Contact form submissions from `contact_messages` table.

- View message details
- Update status: new → read → replied → archived
- Bulk status updates via `POST /api/admin/messages/bulk-update`

---

## Customers tab

Aggregated customer data from the `customers` table (updated on order capture).

- View customer list with order count and total spent
- View individual customer detail and order history
- Soft delete customers (`is_deleted = true`)
- Restore deleted customers

---

## API-only admin features

These are available via API but do not have dedicated dashboard tabs:

| Feature | Endpoints |
|---------|-----------|
| Coupons | `GET/POST/PUT/DELETE /api/coupons` |
| Reviews | `GET /api/reviews`, `PATCH /api/reviews/:id/status` |
| Activity logs | `GET /api/activity/logs`, `/export` |
| PayPal refunds | `POST /api/paypal/refund/:captureId` |
| PayPal test | `GET /api/paypal/test` |

---

## Bulk operations

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin/products/bulk-update` | Bulk product field updates |
| `POST /api/admin/orders/bulk-update` | Bulk order status updates (not cancellation) |
| `POST /api/admin/messages/bulk-update` | Bulk message status updates |

Use dedicated cancel/refund endpoints for order cancellation — not bulk update.

---

## Session management

- `GET /api/admin/sessions` — list active admin sessions
- `POST /api/admin/sessions/cleanup` — remove expired sessions
- `POST /api/admin/logout` — end current session

If your session expires mid-use, API calls return 401. Log in again at `/admin/login`.
