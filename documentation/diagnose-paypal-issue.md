# PayPal Troubleshooting

Diagnose PayPal checkout and webhook issues.

**Full reference:** [`../info.md`](../info.md) | **Setup:** [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md)

---

## Common issues

### PayPal button does not appear

- Check browser console for CSP errors (PayPal domains must be allowed).
- Verify `PAYPAL_CLIENT_ID` and `PAYPAL_SECRET` in backend `.env`.
- Confirm `PAYPAL_MODE` matches credential type (sandbox vs live).

### Create payment fails (500)

- Check backend logs for PayPal auth errors.
- Verify cart items exist and have sufficient stock.
- Check idempotency: previous failed attempt may need reclaim (retry after pending order cancelled).

### Capture fails after PayPal approval

- Verify `serverOrderId` and `accessToken` sent from frontend.
- After PayPal redirect, URL should have `?code=...&token=...` (PayPal order ID in `token`, not the order access token). Frontend calls `GET /api/paypal/checkout-exchange/:code` to obtain the access token. Alternate recovery uses `?aid=` with `GET /api/paypal/checkout-context/:paypalOrderId`.
- Amount mismatch: server auto-refunds and cancels if PayPal captured wrong amount.

### Webhook not processing

- Verify `PAYPAL_WEBHOOK_ID` is set in production.
- Webhook URL must be HTTPS through Cloudflare proxy.
- Check backend logs for signature verification failures.
- Webhook uses raw body parser — must not go through JSON parser first.

### Refund fails

- Admin refund validates against remaining balance (`total - refunded_amount`).
- PayPal capture must exist (`paypal_capture_id` on order).
- Check PayPal dashboard for capture status.

---

## Diagnostic commands

```bash
# Health check
curl https://www.yourdomain.com/api/health

# PayPal connectivity (admin auth required)
curl -b admin_session=... https://www.yourdomain.com/api/paypal/test

# Check backend logs for request ID
# Filter Pino logs by paypal or webhook keywords
```

---

## Sandbox tips

- Use PayPal sandbox buyer accounts from Developer Dashboard.
- Sandbox webhooks may delay — check PayPal webhook event log.
- Use ngrok for local webhook testing.

---

## Related

- [PAYPAL_TESTING_GUIDE.md](./PAYPAL_TESTING_GUIDE.md)
- [DEBUG_FETCH_ERROR.md](./DEBUG_FETCH_ERROR.md)
