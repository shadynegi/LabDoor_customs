# Order Tracking Quickstart

How customers look up their orders.

**Full reference:** [`info.md`](info.md)

---

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | **Place Order** → WhatsApp redirect; `Order ID` in message = `orders.id` UUID (not `GSS-...` order number). |
| **Orders** | Email links: `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` URLs stripped with warning. |
| **Activity** | Consent-gated `POST /api/activity/batch`. |
| **Reviews** | `POST /api/reviews/check` on email blur (storefront). |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Customer flow

1. Customer places order via **Place Order** and completes payment off-site (WhatsApp).
2. After admin **Mark paid**, the customer receives a confirmation email with a **one-time tracking link**.
3. Preferred deep link: `{FRONTEND_URL}/orders?code={exchangeCode}` — redeemed via `GET /api/orders/access-exchange/:code` (returns `orderNumber` + `accessToken`).
4. The customer can also visit `/orders` and enter the **order number** (`GSS-...`) and **access token** manually (`POST /api/orders/lookup`).
5. Multiple tracked orders are stored in browser `sessionStorage` and refreshed automatically; failed refreshes keep last-known status and show a warning.
6. **Deprecated:** `{FRONTEND_URL}/orders?orderNumber=...&token=...` — URL is stripped on load; use email link or manual lookup instead.

---

## Access token

- Generated at place-order (64-character hex string).
- Only a SHA-256 hash (and encrypted copy for email minting) is stored in the database.
- Required for order lookup — sent in the **request body** (`POST /api/orders/lookup`), not in GET query strings.
- Separate from the WhatsApp **Order ID** (which is the `orders.id` UUID for admin lookup).

---

## API

**Preferred lookup:**

```
POST /api/orders/lookup
Content-Type: application/json

{
  "orderNumber": "GSS-2026-00001",
  "accessToken": "64-char-hex-token"
}
```

Returns order details with items and shipping address. Secrets are stripped from the response.

**Alternate lookup:** `GET /api/orders/number/:orderNumber` with `X-Order-Access-Token` header (prefer `POST /api/orders/lookup` so tokens stay out of URLs).

---

## Admin lookup

Admins can search by **order id UUID** (from WhatsApp message), order number, email, or name in the dashboard, or fetch any order via `GET /api/orders/:id`.
