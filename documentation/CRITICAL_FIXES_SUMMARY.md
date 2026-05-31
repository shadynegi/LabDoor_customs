# Payment and Order Reliability

Reliability features for checkout, refunds, and order sync.

**Full reference:** [`../info.md`](../info.md) — Checkout and payments section

## Atomic checkout

- Stock decremented in same transaction as pending order creation
- Coupon reservations tied to order lifecycle
- Pending orders expire via maintenance job; stock restored on expiry/cancel

## PayPal integration

- Create-payment → capture → webhook three-path reconciliation
- Webhook amount validation against order total
- Refund idempotency via `refund_events` table and PayPal-Request-Id
- Admin cancel with refund syncs DB only after PayPal confirms

## Idempotency

- Client-supplied idempotency keys on create-payment and refunds
- Reclaim logic for stale pending keys
- Redis + database backing
