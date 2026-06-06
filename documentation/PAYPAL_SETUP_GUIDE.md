# PayPal Setup Guide

Configure PayPal Checkout for Lab Door Customs.

**Full reference:** [`info.md`](info.md)

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

## Checkout flow (how payments bind to server orders)

1. **Create payment** — `POST /api/paypal/create-payment` validates the cart, inserts a pending order, decrements stock, creates a PayPal order with `reference_id` = server order UUID, and stores a one-time checkout exchange code (30-minute TTL).
2. **PayPal return URL** — `{FRONTEND_URL}/payment/success?code={exchangeCode}`; PayPal appends `&token={paypalOrderId}`. The order access token is **not** in the URL.
3. **Payment success page** — redeems `code` via `GET /api/paypal/checkout-exchange/:code` to obtain `accessToken` and `serverOrderId`.
4. **Capture** — `POST /api/paypal/capture-payment/:paypalOrderId` requires `serverOrderId`, `accessToken`, and matching `paypal_order_id` binding.

Set `ORDER_TOKEN_ENCRYPTION_KEY` in production for checkout exchange token encryption at rest.

---

## Local webhook testing

Use ngrok to expose port 5000, register the ngrok URL + `/api/paypal/webhook` in PayPal sandbox.

See [PAYPAL_TESTING_GUIDE.md](./PAYPAL_TESTING_GUIDE.md).
