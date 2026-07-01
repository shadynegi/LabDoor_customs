# Order Management Guide

Admin workflows for order fulfillment.

**Full reference:** [`info.md`](info.md) | **Dashboard:** [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md) | **Checkout:** [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md)

---

## Order states

| payment_status | status | Meaning |
|----------------|--------|---------|
| pending | pending | Awaiting payment confirmation (WhatsApp / manual) |
| completed | processing | Paid, ready to fulfill |
| completed | shipped | Shipped with tracking |
| completed | delivered | Delivered |
| refunded | cancelled | Fully refunded |
| failed | cancelled | Checkout failed or expired |

---

## Fulfillment workflow

1. Customer places order via **Place Order** → order appears as **pending** in admin.
2. After payment is confirmed on WhatsApp, admin opens the order and clicks **Mark paid** with a payment reference.
3. Order moves to **processing**; confirmation email sends if Resend is configured.
4. Enter tracking number, carrier, optional tracking URL, and optional **estimated delivery** date → **Save tracking** (`PUT /api/orders/:id` includes `estimated_delivery`).
5. Click **Notify shipped** (`POST /api/orders/:id/notify-shipped`) — requires tracking number.
6. Use **Mark shipped** / **Mark delivered** for status transitions.

Orders are paginated (50 per page). Use the search box to find orders by **order id** (UUID), order number, customer email, or name — search runs server-side across the full order list (`GET /api/orders?search=`). The WhatsApp message includes the **Order ID** (`orders.id` UUID) for lookup.

Use **Cancel order** in the modal for cancellations (not bulk update).

---

## Manual mark paid

After confirming payment (WhatsApp, UPI, bank transfer, etc.), use **Mark paid** in the order modal. The API requires a reason and a payment reference:

```json
PATCH /api/orders/:id/payment-status
{
  "payment_status": "completed",
  "admin_note": "your reason (min 3 characters)",
  "payment_id": "EXTERNAL_PAYMENT_REF (min 5 characters)"
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
| Mark paid (manual) | `PATCH /api/orders/:id/payment-status` — `{ "payment_status": "completed", "admin_note": "...", "payment_id": "..." }` |
