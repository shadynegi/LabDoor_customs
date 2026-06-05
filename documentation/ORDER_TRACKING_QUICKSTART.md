# Order Tracking Quickstart

How customers look up their orders.

**Full reference:** [`../info.md`](../info.md)

---

## Customer flow

1. After payment, the customer receives a confirmation email with a tracking link.
2. Deep link format: `{FRONTEND_URL}/orders?orderNumber={orderNumber}&token={accessToken}`
3. The customer can also visit `/orders` and enter the order number and access token manually.
4. Multiple tracked orders are stored in browser `sessionStorage` and refreshed automatically.

---

## Access token

- Generated at order creation (64-character hex string).
- Only a SHA-256 hash is stored in the database.
- Required for order lookup, payment capture, and checkout context recovery.
- Sent to the API in the **request body** (`POST /api/orders/lookup`), not in GET query strings.

---

## API

**Preferred lookup:**

```
POST /api/orders/lookup
Content-Type: application/json

{
  "orderNumber": "LDC-2026-00001",
  "accessToken": "64-char-hex-token"
}
```

Returns order details with items and shipping address. Secrets are stripped from the response.

**Alternate lookup:** `GET /api/orders/number/:orderNumber?token={accessToken}`

---

## Admin lookup

Admins can view any order without a customer token via the dashboard or `GET /api/orders/:id`.
