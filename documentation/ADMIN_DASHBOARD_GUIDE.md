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

- Order counts and revenue (all time + last 30 days)
- **Sales period filter** — day, week, month, year, or all (`?period=` on analytics API)
- **Units sold**, revenue, average order value, and **revenue change vs prior period** for the selected range
- **Top sellers** by units and revenue; **revenue by product** table with share %
- **Best sales period** in range (highest-revenue bucket)
- **Low-stock alert** — products at or below reorder point (`inventory.low_stock_products`)
- Product engagement metrics (views, cart adds)
- Customer statistics and geographic breakdown
- **Export CSV** — `GET /api/admin/analytics/export?period=` (product sales for selected period)
- GA4 and Google Search Console configuration status with external dashboard links

Data source: `GET /api/admin/analytics?period=day|week|month|year|all|custom&from=&to=`

Response includes `sales` (period metrics) and `inventory` (low-stock summary). Cached 5–15 min per period (`ADMIN_ANALYTICS_CACHE_TTL_MS`).

If the analytics API fails, the tab shows an error message with a **Retry** button.

---

## Products tab

- View products with stock and status — **50 per page** with **Load more** and total count (`GET /api/products?limit=50&page=`)
- **Search** — debounced server-side query via `POST /api/products/search` (searches full catalog, not only loaded pages)
- **Load more** — paginated list via `GET /api/products?limit=50&page=` when not searching
- Error banner with **Retry** if the product list fails to load
- **Coupons / Reviews** — product scope uses **server search** (`AdminProductSearchPicker` → `POST /api/products/search`), not a fixed 100-product list
- Create new products (name, price, images, optional **360° MP4 video**, **SKU**, **reorder point**, optional **cost price**, category, size, color, stock)
- Edit existing products (stock changes are logged to `inventory_movements`)
- Delete products
- **Bulk stock** — set absolute stock or apply delta for selected products via `POST /api/admin/products/bulk-update` (`stock`, `stock_delta`, or `is_out_of_stock`)
- **Low-stock filter** — highlight products below reorder point
- **Stock history** — per-product movement log via `GET /api/admin/products/:id/inventory-movements`
- Bulk mark in/out of stock via same bulk-update endpoint

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

- **Tracking** — save tracking number, carrier, optional tracking URL, and **estimated delivery** date (`PUT /api/orders/:id`)
- **Notify shipped** — `POST /api/orders/:id/notify-shipped` (requires tracking number)
- **Status** — Mark processing, shipped, or delivered (valid transitions enforced)
- **Mark paid** — prompts for a reason, then `PATCH /api/orders/:id/payment-status` with `completed`, `admin_note` (≥3 chars), and `payment_id` (external reference or capture ID, ≥5 chars); logged to `activity_logs` as `admin_mark_paid`
- **Edit customer details** — `PATCH /api/orders/:id/customer-details` (name, email, shipping address, admin notes; does not change paid line totals)
- **Edit pending items** — `PATCH /api/orders/:id/pending-items` (unpaid pending orders only; adjusts inventory)
- **Cancel order** — prompts for optional reason; dismiss the prompt to abort. Uses `POST /api/orders/:id/cancel` (**unpaid pending orders only** — no customer refunds)

### Bulk updates

Bulk status dropdown supports processing, shipped, and delivered only. **Cancelled** is not available in bulk — use the order modal cancel action. Bulk endpoints accept at most **500** order IDs per request; each order's status transition is validated server-side. `payment_status` cannot be changed via bulk update.

### Cancel orders

**Store policy:** All sales are final — no customer refunds. Manufacturing-defect replacements are handled manually via support email (see `/returns-policy` on the storefront).

**Pending (unpaid) orders:** Cancel restores inventory automatically.

**Paid / completed orders:** Cancel and refund endpoints return **403**. Use the replacement workflow for verified manufacturing defects — not the admin dashboard.

### Payment status

`PATCH /api/orders/:id/payment-status` allows marking pending orders as **completed** when accompanied by `admin_note` (≥3 characters). Paid orders cannot be cancelled through the API.

---

## Coupons tab

Manage discount codes used at checkout (server-side billing via `resolveCouponDiscount`).

- **Quick presets** — create `SAVE5`, `SAVE10`, `SAVE20`, `SAVE25`, `SAVE50` (percentage off, entire order)
- **Custom coupon** — any code + 5–50% discount + **scope**: entire order, specific product IDs, or category IDs (`applies_to` / `applies_to_ids` on `POST /api/coupons`)
- **Edit** — pencil icon opens a modal to update description, max uses, valid-until date, **applies_to scope** (all / product / category IDs), and active status (`PUT /api/coupons/:id`)
- **Activate / deactivate** — toggle `is_active` without deleting
- **Delete** — remove unused coupons

On narrow screens, the coupons table scrolls horizontally.

API: `GET/POST/PUT/DELETE /api/coupons`

---

## Messages tab

Contact form submissions from `contact_messages` table.

- Error banner with **Retry** if the inbox fails to load
- Click a message to open the detail modal — **new** messages are automatically marked **read** via `PATCH /api/contact/:id/status`
- Modal actions: **Reply via Email** (mailto), **Mark replied**, **Archive**
- Bulk status updates via `POST /api/admin/messages/bulk-update`

---

## Customers tab

Aggregated customer data from the `customers` table (updated on order capture).

- **Server-side search** and **pagination** (`GET /api/admin/customers?search=&page=&limit=`)
- View customer list with order count, total spent, phone, first/last order dates (table on desktop, cards on mobile)
- **Edit profile** — `PATCH /api/admin/customers/:id` (name, phone, admin notes; does not rewrite historical order snapshots)
- **View History** — opens a modal with customer stats and order list; shows a loading state while fetching and a toast on failure
- Soft delete customers (`is_deleted = true`) — **Delete** button in table
- Restore deleted customers — enable **Show deleted customers**, then **Restore**
- Toggle **Show deleted customers** to include soft-deleted rows
- **Recompute aggregates** — `POST /api/admin/customers/recompute` (refresh totals from completed orders)

---

## Reviews tab

Manage customer reviews from the **Reviews** tab.

- **Customer email is admin-only** — the public product page and public review API never expose `customer_email`; only this tab and admin API routes include it.
- View all reviews with **customer name**, **email**, rating, product, status, and text
- Filter by status (pending, approved, rejected, flagged)
- **Quick Approve / Reject** for pending reviews
- Pagination — 50 reviews per page
- **Create Review** — modal to add a review with customer name, optional email, product, rating, title, body, status, and verified-purchase badge
- **Edit** — update any review field, status, or **admin response** (customer-visible reply on the storefront)
- **Delete** — remove a review permanently

API: `GET /api/reviews`, `POST /api/reviews/admin`, `PATCH /api/reviews/:id`, `DELETE /api/reviews/:id`

---

## API-only admin features

These are available via API but do not have dedicated dashboard tabs:

| Feature | Endpoints |
|---------|-----------|
| Activity logs | `GET /api/activity/logs`, `/export` |
| PayPal refunds | `POST /api/paypal/refund/:captureId` — **disabled** (403; no-refund policy) |
| PayPal test | `GET /api/paypal/test` |

---

## Bulk operations

| Endpoint | Purpose |
|----------|---------|
| `POST /api/admin/products/bulk-update` | Bulk product updates (`stock`, `stock_delta`, `is_out_of_stock`) |
| `GET /api/admin/products/low-stock` | Products at or below reorder point |
| `GET /api/admin/products/:id/inventory-movements` | Stock movement audit log |
| `GET /api/admin/analytics/export` | CSV export of product sales for period |
| `PATCH /api/admin/customers/:id` | Update customer CRM profile |
| `POST /api/admin/customers/recompute` | Rebuild customer aggregates from orders |
| `POST /api/admin/orders/bulk-update` | Bulk order status updates (not cancellation) |
| `POST /api/admin/messages/bulk-update` | Bulk message status updates |

Use the dedicated cancel endpoint for unpaid pending orders — not bulk update.

---

## Session management

- `GET /api/admin/sessions` — list active admin sessions
- `POST /api/admin/sessions/cleanup` — remove expired sessions
- `POST /api/admin/logout` — end current session

If your session expires mid-use, API calls return 401. Log in again at `/admin/login`.
