# Order Tracking Setup

Configure customer order lookup.

**Full reference:** [`info.md`](info.md)

---

## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID). |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** after off-site payment; confirmation email when Resend configured. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## How it works

Each order receives a unique **access token** at place-order time (64-character hex). The token is:

- Hashed with SHA-256 and stored as `access_token_hash` on the order row (plaintext never persisted)
- Encrypted with AES-256-GCM as `access_token_encrypted` for durable email link minting
- Required for customer order lookup via `POST /api/orders/lookup`
- **Not** included in the WhatsApp message (WhatsApp shows `Order ID: {orders.id}` UUID only)

After admin **Mark paid**, the confirmation email includes a **one-time tracking link** (`/orders?code=...`) redeemed via `GET /api/orders/access-exchange/:code`.

---

## Frontend

| Route | Behavior |
|-------|----------|
| `/orders` | Form for order number + access token; preferred email deep link `?code=` (access exchange); legacy `?orderNumber=&token=` stripped with deprecation warning |
| `/payment/success` | Optional confirmation page after Place Order; reads `lastPlacedOrder` from sessionStorage (order number + totals; not required for tracking) |

The My Orders page sends lookup requests with `POST /api/orders/lookup` so tokens are not passed in URL query strings.

---

## Backend

| Endpoint | Purpose |
|----------|---------|
| `POST /api/orders/lookup` | Preferred customer lookup — `{ orderNumber, accessToken }` in JSON body |
| `GET /api/orders/number/:orderNumber` | Alternate lookup — token via `X-Order-Access-Token` header only |
| `GET /api/orders/customer/:email` | Admin only (public email listing blocked) |
| `GET /api/orders/access-exchange/:code` | Redeem one-time email tracking link → `orderNumber` + `accessToken` + `serverOrderId` |

Admin order search (`GET /api/orders?search=`) matches **order id UUID**, order number, email, and customer name.

---

## Email

Order confirmation (sent after admin **Mark paid**) includes a **View Order Status** link: `/orders?code=...` (one-time access exchange — no long-lived token in the URL).

Requires Resend configuration: `RESEND_API_KEY`, `SENDER_EMAIL`.
