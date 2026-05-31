# Order Tracking Quickstart

How customers look up their orders.

**Full reference:** [`../info.md`](../info.md)

---

## Customer flow

1. After payment, customer receives confirmation email with tracking link.
2. Link format: `{FRONTEND_URL}/orders?order={orderNumber}&token={accessToken}`
3. Customer can also visit `/orders` and enter order number + access token manually.

---

## Access token

- Generated at order creation (64-character hex string).
- Only SHA-256 hash stored in database.
- Required for: order lookup, payment capture, checkout recovery.

---

## API

`GET /api/orders/number/:orderNumber?token={accessToken}`

Returns order details with items and shipping address. Secrets stripped from response.

---

## Admin lookup

Admins can look up any order without token via dashboard or `GET /api/orders/:id`.
