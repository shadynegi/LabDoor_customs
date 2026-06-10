# Order Management Guide

Admin workflows for order fulfillment.

**Full reference:** [`info.md`](info.md) | **Dashboard:** [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md)

---

## Order states

| payment_status | status | Meaning |
|----------------|--------|---------|
| pending | pending | Awaiting PayPal payment |
| completed | processing | Paid, ready to fulfill |
| completed | shipped | Shipped with tracking |
| completed | delivered | Delivered |
| refunded | cancelled | Fully refunded |
| failed | cancelled | Checkout failed or expired |

---

## Fulfillment workflow

1. Order appears as **processing** after PayPal capture (or after admin **Mark paid** for offline payments).
2. Open the order in the admin dashboard **Orders** tab → click order card.
3. Enter tracking number, carrier, optional tracking URL, and optional **estimated delivery** date → **Save tracking** (`PUT /api/orders/:id` includes `estimated_delivery`).
4. Click **Notify shipped** (`POST /api/orders/:id/notify-shipped`) — requires tracking number.
5. Use **Mark shipped** / **Mark delivered** for status transitions.

Orders are paginated (50 per page). Use the search box to find orders by order number, customer email, or name — search runs server-side across the full order list (`GET /api/orders?search=`).

Use **Cancel order** in the modal for cancellations (not bulk update).

---

## Manual mark paid

For offline or non-PayPal payments, use **Mark paid** in the order modal. The API requires a reason and a payment reference:

```json
PATCH /api/orders/:id/payment-status
{
  "payment_status": "completed",
  "admin_note": "your reason (min 3 characters)",
  "payment_id": "CAPTURE_OR_EXTERNAL_REF_ID (min 5 characters)"
}
```

Each manual mark is recorded in `activity_logs` as `admin_mark_paid`.

---

## Bulk status updates

`POST /api/admin/orders/bulk-update` accepts up to **500** order IDs and a fulfillment `status` only. The server validates each order's status transition (`pending` → `processing` → `shipped` → `delivered`). Bulk update rejects `cancelled` status and any `payment_status` change — use the order modal cancel flow or `PATCH /api/orders/:id/payment-status` instead.

---

## Cancellation and replacements

**Store policy:** All sales are final — no customer refunds. Manufacturing-defect replacements are handled via support email (see Replacement Policy on the storefront).

**Pending unpaid orders:** **Cancel unpaid order** in the admin modal restores inventory immediately.

**Paid / completed orders:** Cannot be cancelled or refunded through the admin dashboard or API. Use the manual replacement workflow for verified manufacturing defects.

---

## API endpoints

| Action | Endpoint |
|--------|----------|
| List / search | `GET /api/orders?page=&limit=50&status=&search=` |
| Customer lookup | `POST /api/orders/lookup` — `{ orderNumber, accessToken }` |
| Update | `PUT /api/orders/:id` |
| Status | `PATCH /api/orders/:id/status` |
| Cancel | `POST /api/orders/:id/cancel` |
| Ship notify | `POST /api/orders/:id/notify-shipped` |
| Mark paid (manual) | `PATCH /api/orders/:id/payment-status` — `{ "payment_status": "completed", "admin_note": "..." }` |
| Refund | `POST /api/paypal/refund/:captureId` — **disabled** (403; no-refund policy) |
