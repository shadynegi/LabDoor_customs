# Order Tracking Quickstart

How customers look up their orders.

**Full reference:** [`info.md`](info.md)

---

## Customer flow

1. Customer places order via **Place Order** and completes payment off-site (WhatsApp).
2. After admin **Mark paid**, the customer receives a **WhatsApp message** (Cloud API when configured) with a **Track order** link (`/orders?orderId={uuid}`).
3. On `/orders`, enter the **order ID** (pre-filled from the link when applicable) and the **email used at checkout**, then click **Search**.
4. While the page stays open, **Refresh** and **auto-refresh** update status in memory. A **full browser reload** clears order details — the customer enters order ID and email again. Track-order links still pre-fill the order ID field only.

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
| API | `Tests/integration/api/orders/lookup.test.ts` | Valid/invalid lookup, case-insensitive email, shipped tracking, deprecated access-exchange 410, admin-only GET |
| UI | `Tests/e2e/specs/orders/orders-ui.spec.ts` | Email link prefill, lookup form, reload clears details, errors, shipped tracking link |
| Unit | `Tests/unit/backend/orders/orderPortalUrl.test.ts` | Order portal URL (`/orders?orderId={uuid}`) via `orderPortalUrl.ts` |

