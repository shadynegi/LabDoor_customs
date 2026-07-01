# Order Tracking Quickstart

How customers look up their orders.

**Full reference:** [`info.md`](info.md)

---

## Customer flow

1. Customer places order via **Place Order** and completes payment off-site (WhatsApp).
2. After admin **Mark paid**, the customer receives a confirmation email and WhatsApp message (when Cloud API is configured) with a **Track order** link (`/orders?orderId={uuid}`).
3. On `/orders`, enter the **order ID** (pre-filled from email link when applicable) and the **email used at checkout**, then click **Search**.
4. Multiple tracked orders are stored in browser `sessionStorage` and refreshed automatically; failed refreshes keep last-known status and show a warning.

---

## API

**Lookup:**

```
POST /api/orders/lookup
Content-Type: application/json
X-CSRF-Token: ...

{
  "orderId": "00000000-0000-0000-0000-000000000001",
  "email": "customer@example.com"
}
```

Returns order details with items and shipping address. Secrets are stripped from the response.

Wrong order ID or email returns **404** with a generic error (anti-enumeration).

---

## Admin lookup

Admins can search by order id UUID, order number, email, or name in the dashboard, or fetch any order via `GET /api/orders/:id`.

---

## Automated tests

| Layer | Files | Coverage |
|-------|-------|----------|
| API | `Tests/api/orderLookup.test.ts`, `orderTracking.test.ts` | Valid/invalid lookup, case-insensitive email, shipped tracking, deprecated access-exchange 410 |
| UI | `Tests/frontend/orders-ui.spec.ts` | Email link prefill, lookup form, sessionStorage, errors, shipped tracking link |
| Unit | `Tests/backend/emailPortalUrl.test.ts` | Confirmation email track URL (`/orders?orderId={uuid}`) |

