# Order Tracking Setup

Configure customer order lookup.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** → processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. 
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_form_submit` on contact success. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## How it works

Each order receives a unique access token at PayPal create-payment time. The token is:

- Emailed to the customer in the order confirmation
- Validated server-side against `access_token_hash` on the order row (only the hash is stored)
- Used for order lookup and payment capture — **not** placed in the PayPal return URL

After PayPal approval, the customer returns to `/payment/success?code=...&token=...`. The frontend redeems the one-time `code` via checkout exchange to obtain the access token for capture.

---

## Frontend

| Route | Behavior |
|-------|----------|
| `/orders` | Form for order number + access token; preferred email deep link `?code=` (access exchange); legacy `?orderNumber=&token=` stripped with deprecation warning |
| `/payment/success` | Redeems checkout exchange code, captures payment; **409** processing state; saves tracked order to `sessionStorage` on success |

The My Orders page sends lookup requests with `POST /api/orders/lookup` so tokens are not passed in URL query strings.

---

## Backend

| Endpoint | Purpose |
|----------|---------|
| `POST /api/orders/lookup` | Preferred customer lookup — `{ orderNumber, accessToken }` in JSON body |
| `GET /api/orders/number/:orderNumber` | Alternate lookup — token via `?token=` or `X-Order-Access-Token` header |
| `GET /api/orders/customer/:email` | Admin only (public email listing blocked) |
| `GET /api/paypal/checkout-exchange/:code` | Redeem one-time code after PayPal redirect |
| `GET /api/orders/access-exchange/:code` | Redeem one-time email tracking link → `orderNumber` + `accessToken` |

---

## Email

Order confirmation (sent after capture) includes the tracking URL with embedded token.

Requires Resend configuration: `RESEND_API_KEY`, `SENDER_EMAIL`.
