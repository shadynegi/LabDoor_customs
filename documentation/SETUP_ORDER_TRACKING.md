# Order Tracking Setup

Configure customer order lookup.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; PayPal checkout exchange `?code=`; order tracking links use `GET /api/orders/access-exchange/:code` (no token in email URL); capture requires `serverOrderId` + `accessToken`. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel without refund; product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
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
| `/orders` | Form for order number + access token; supports deep link `?orderNumber=&token=` |
| `/payment/success` | Redeems checkout exchange code, captures payment, may save token to `sessionStorage` for My Orders |

The My Orders page sends lookup requests with `POST /api/orders/lookup` so tokens are not passed in URL query strings.

---

## Backend

| Endpoint | Purpose |
|----------|---------|
| `POST /api/orders/lookup` | Preferred customer lookup — `{ orderNumber, accessToken }` in JSON body |
| `GET /api/orders/number/:orderNumber` | Alternate lookup — token via `?token=` or `X-Order-Access-Token` header |
| `GET /api/orders/customer/:email` | Admin only (public email listing blocked) |
| `GET /api/paypal/checkout-exchange/:code` | Redeem one-time code after PayPal redirect |

---

## Email

Order confirmation (sent after capture) includes the tracking URL with embedded token.

Requires Resend configuration: `RESEND_API_KEY`, `SENDER_EMAIL`.
