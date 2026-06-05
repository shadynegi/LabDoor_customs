# PayPal Testing Guide

Test PayPal checkout in sandbox mode.

**Full reference:** [`../info.md`](../info.md)

---

## Prerequisites

- Backend running with `PAYPAL_MODE=sandbox`
- Sandbox buyer account from PayPal Developer Dashboard
- At least one in-stock product in the database

---

## Test flow

1. Add product to cart on storefront.
2. Go to checkout, fill customer/shipping details.
3. Click PayPal — redirected to sandbox PayPal.
4. Log in with sandbox buyer credentials and approve.
5. Redirected to `/payment/success?code=...&token=...` — frontend redeems `code` via `GET /api/paypal/checkout-exchange/:code` to obtain the access token, then capture runs automatically.
6. Verify order in admin dashboard (`payment_status: completed`).

---

## Checkout exchange

`create-payment` returns `serverOrderId` and PayPal approval links but **does not** return the access token. The token is delivered only when the success page redeems the one-time `code` from the PayPal return URL. Each code is single-use, expires in 30 minutes, and is stored hashed with the token encrypted at rest.

---

## Verify server behavior

- Pending order created before PayPal redirect
- Stock decremented on create-payment
- Stock restored if payment abandoned (pending order expires after TTL)
- Confirmation email sent after capture
- Order lookup works with access token from email (`POST /api/orders/lookup`)
- Capture returns **409** if PayPal capture succeeds but the database order is not `payment_status=completed`
- Webhook `PAYMENT.CAPTURE.COMPLETED` reconciles amount (PayPal API fallback when missing) and returns **500** on reconciliation failure so PayPal retries

---

## Test refunds

1. Admin dashboard → cancel completed order with refund enabled.
2. Or `POST /api/paypal/refund/:captureId` as admin.

---

## Troubleshooting

See [diagnose-paypal-issue.md](./diagnose-paypal-issue.md).
