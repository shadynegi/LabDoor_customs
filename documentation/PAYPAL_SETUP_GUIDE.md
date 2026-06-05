# PayPal Setup Guide

Configure PayPal Checkout for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

---

## Sandbox (development)

1. Create a developer account at [developer.paypal.com](https://developer.paypal.com).
2. Create a REST API app under **Apps & Credentials → Sandbox**.
3. Copy Client ID and Secret to `backend/.env`:

```
PAYPAL_CLIENT_ID=...
PAYPAL_SECRET=...
PAYPAL_MODE=sandbox
```

---

## Live (production)

1. Switch to **Live** credentials in PayPal Developer Dashboard.
2. Set `PAYPAL_MODE=live` on the backend.
3. Create a webhook (see below).

---

## Webhooks

**URL:** `https://www.yourdomain.com/api/paypal/webhook`

**Events to subscribe:**

- `PAYMENT.CAPTURE.COMPLETED`
- `PAYMENT.CAPTURE.DENIED`
- `PAYMENT.CAPTURE.REFUNDED`
- `PAYMENT.CAPTURE.REVERSED`

Copy the Webhook ID to `PAYPAL_WEBHOOK_ID` (required in production).

The backend verifies signatures using the raw request body before JSON parsing.

---

## Local webhook testing

Use ngrok to expose port 5000, register the ngrok URL + `/api/paypal/webhook` in PayPal sandbox.

See [PAYPAL_TESTING_GUIDE.md](./PAYPAL_TESTING_GUIDE.md).
