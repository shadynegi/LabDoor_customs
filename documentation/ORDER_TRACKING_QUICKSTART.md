# Order Tracking Quickstart

How customers look up their orders.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | PayPal checkout exchange `?code=`; capture requires `serverOrderId` + `accessToken`. |
| **Orders** | Email links: `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` URLs stripped with warning. |
| **Activity** | Consent-gated `POST /api/activity/batch`. |
| **Reviews** | `POST /api/reviews/check` on email blur (storefront). |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Customer flow

1. After payment, the customer receives a confirmation email with a **one-time tracking link**.
2. Preferred deep link: `{FRONTEND_URL}/orders?code={exchangeCode}` — redeemed via `GET /api/orders/access-exchange/:code` (returns `orderNumber` + `accessToken`).
3. The customer can also visit `/orders` and enter the order number and access token manually (`POST /api/orders/lookup`).
4. Multiple tracked orders are stored in browser `sessionStorage` and refreshed automatically; failed refreshes keep last-known status and show a warning.
5. **Deprecated:** `{FRONTEND_URL}/orders?orderNumber=...&token=...` — URL is stripped on load; use email link or manual lookup instead.

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
