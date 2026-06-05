# Order Management Guide

Admin workflows for order fulfillment.

**Full reference:** [`../info.md`](../info.md) | **Dashboard:** [ADMIN_DASHBOARD_GUIDE.md](./ADMIN_DASHBOARD_GUIDE.md)

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
3. Enter tracking number, carrier, and optional tracking URL → **Save tracking**.
4. Click **Notify shipped** (`POST /api/orders/:id/notify-shipped`) — requires tracking number.
5. Use **Mark shipped** / **Mark delivered** for status transitions.

Orders are paginated (50 per page). Use the search box to find orders by order number, customer email, or name — search runs server-side across the full order list (`GET /api/orders?search=`).

Use **Cancel order** in the modal for cancellations (not bulk update).

---

## Manual mark paid

For offline or non-PayPal payments, use **Mark paid** in the order modal. The dashboard prompts for a reason (minimum 3 characters). The API requires:

```json
PATCH /api/orders/:id/payment-status
{ "payment_status": "completed", "admin_note": "your reason" }
```

Each manual mark is recorded in `activity_logs` as `admin_mark_paid`.

---

## Cancellation

**Pending orders:** Cancel restores inventory immediately.

**Completed orders:** Cancel with `process_refund: true`:

- Refunds remaining balance via PayPal
- Marks order refunded, restores inventory
- Reverses customer credit stats

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
| Refund | `POST /api/paypal/refund/:captureId` |
