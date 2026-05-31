# PayPal Integration Reference

PayPal Checkout integration in Lab Door Customs.

**Full reference:** [`../info.md`](../info.md) | **Setup:** [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md)

## Flow

1. `POST /api/paypal/create-payment` — creates pending order, PayPal order
2. Customer approves on PayPal
3. `POST /api/paypal/capture` — captures payment, sends confirmation email
4. Webhooks reconcile capture/refund/denial events

## Security

- Webhook signature verification on raw body
- Capture amount validated against order total
- Refund idempotency and remaining-balance guards
