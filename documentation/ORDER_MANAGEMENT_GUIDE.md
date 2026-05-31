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

1. Order appears as **processing** after PayPal capture.
2. Admin sets tracking number, carrier, estimated delivery.
3. Admin sends shipping notification (`POST /api/orders/:id/notify-shipped`).
4. Update status to **shipped**, then **delivered** when confirmed.

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
| List | `GET /api/orders` |
| Update | `PUT /api/orders/:id` |
| Status | `PATCH /api/orders/:id/status` |
| Cancel | `POST /api/orders/:id/cancel` |
| Ship notify | `POST /api/orders/:id/notify-shipped` |
| Refund | `POST /api/paypal/refund/:captureId` |
