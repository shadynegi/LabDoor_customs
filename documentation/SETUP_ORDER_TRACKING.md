# Order Tracking Setup

Configure customer order lookup.

**Full reference:** [`../info.md`](../info.md)

---

## How it works

Each order receives a unique access token at PayPal create-payment time. The token is:

- Emailed to the customer in the order confirmation
- Embedded in the tracking URL query string
- Validated server-side against `access_token_hash` on the order row

---

## Frontend

- Route: `/orders` — form for order number + access token
- Payment success page uses `?aid=` query param for checkout recovery when localStorage is unavailable

---

## Backend

- `GET /api/orders/number/:orderNumber` — requires token (or admin auth)
- `GET /api/orders/customer/:email` — admin only (public email listing blocked)

---

## Email

Order confirmation (sent after capture) includes the tracking URL with embedded token.

Requires Resend configuration: `RESEND_API_KEY`, `SENDER_EMAIL`.
