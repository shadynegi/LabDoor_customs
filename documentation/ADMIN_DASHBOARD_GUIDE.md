# Admin Dashboard Guide

How to use the Lab Door Customs admin dashboard.

**Full reference:** [`info.md`](info.md)

---

## Access

| Item | Value |
|------|-------|
| Login URL | `/admin/login` |
| Dashboard URL | `/adminshivamdashboard` |
| Session | HttpOnly cookie, 24 hours |

Login with admin username and password. Sessions are stored server-side in `admin_sessions` as **SHA-256 hashes** of the session token (the raw token is never persisted).

Generate a production password hash locally with `node backend/scripts/generate-admin-hash.mjs "your-password"` and set `ADMIN_PASSWORD_HASH` on the backend. The `/api/admin/generate-hash` route is development-only.

---

## Analytics tab

Displays:

- Order counts and revenue (completed vs pending)
- Product metrics (views, cart adds)
- Customer statistics
- Geographic breakdown from activity logs
- GA4 and Google Search Console configuration status with external dashboard links

Data source: `GET /api/admin/analytics`

If the analytics API fails, the tab shows an error message with a **Retry** button.

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

- **Search** — type in the search box to filter by order number, customer email, or name (debounced server-side query via `?search=`).
- **Status filter** — dropdown filters by fulfillment status (`pending`, `processing`, `shipped`, `delivered`, `cancelled`).
- **Pagination** — 50 orders per page with previous/next controls.

Data source: `GET /api/orders?page=&limit=50&status=&search=`.

### Order detail modal

Click an order card to open fulfillment actions:

- **Tracking** — save tracking number, carrier, optional tracking URL
- **Notify shipped** — `POST /api/orders/:id/notify-shipped` (requires tracking number)
- **Status** — Mark processing, shipped, or delivered (valid transitions enforced)
- **Mark paid** — prompts for a reason, then `PATCH /api/orders/:id/payment-status` with `completed`, `admin_note` (≥3 chars), and `payment_id` (external reference or capture ID, ≥5 chars); logged to `activity_logs` as `admin_mark_paid`
- **Cancel order** — prompts for optional reason; dismiss the prompt to abort. Uses `POST /api/orders/:id/cancel` with optional PayPal refund

### Bulk updates

Bulk status dropdown supports processing, shipped, and delivered only. **Cancelled** is not available in bulk — use the order modal cancel action. Bulk endpoints accept at most **500** order IDs per request; each order's status transition is validated server-side. `payment_status` cannot be changed via bulk update.

### Cancel orders

**Pending orders:** Cancels and restores inventory automatically.

**Completed orders with refund:**

1. Set `process_refund: true` in cancel request.
2. Backend refunds remaining balance via PayPal.
3. Order marked refunded, inventory restored, customer stats reversed.

If PayPal refund succeeds but DB sync fails, the API returns 502 — reconcile manually in PayPal dashboard.

### Payment status

`PATCH /api/orders/:id/payment-status` allows marking pending orders as **completed** when accompanied by `admin_note` (≥3 characters). Use cancel/refund flows to move away from completed.

---

## Coupons tab

Manage discount codes used at checkout (server-side billing via `resolveCouponDiscount`).

- **Quick presets** — create `SAVE5`, `SAVE10`, `SAVE20`, `SAVE25`, `SAVE50` (percentage off)
- **Custom coupon** — any code + 5–50% discount
- **Edit** — pencil icon opens a modal to update description, max uses, valid-until date, and active status (`PUT /api/coupons/:id`)
- **Activate / deactivate** — toggle `is_active` without deleting
- **Delete** — remove unused coupons

On narrow screens, the coupons table scrolls horizontally.

API: `GET/POST/PUT/DELETE /api/coupons`

---

## Messages tab

Contact form submissions from `contact_messages` table.

- View message details
- Update status: new → read → replied → archived
- Bulk status updates via `POST /api/admin/messages/bulk-update`

---

## Customers tab

Aggregated customer data from the `customers` table (updated on order capture).

- View customer list with order count and total spent (table scrolls horizontally on mobile)
- **View History** — opens a modal with customer stats and order list; shows a loading state while fetching and a toast on failure
- Soft delete customers (`is_deleted = true`) — **Delete** button in table
- Restore deleted customers — enable **Show deleted customers**, then **Restore**
- Toggle **Show deleted customers** to include soft-deleted rows

---

## Reviews tab

Manage customer reviews from the **Reviews** tab.

- **Customer email is admin-only** — the public product page and public review API never expose `customer_email`; only this tab and admin API routes include it.
- View all reviews with **customer name**, **email**, rating, product, status, and text
- Filter by status (pending, approved, rejected, flagged)
- **Quick Approve / Reject** for pending reviews
- Pagination — 50 reviews per page
- **Create Review** — modal to add a review with customer name, optional email, product, rating, title, body, status, and verified-purchase badge
- **Edit** — update any review field or status
- **Delete** — remove a review permanently

API: `GET /api/reviews`, `POST /api/reviews/admin`, `PATCH /api/reviews/:id`, `DELETE /api/reviews/:id`

---

## API-only admin features

These are available via API but do not have dedicated dashboard tabs:

| Feature | Endpoints |
|---------|-----------|
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
