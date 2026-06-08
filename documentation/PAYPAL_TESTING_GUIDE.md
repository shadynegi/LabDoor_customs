# PayPal Testing Guide

Test PayPal checkout in sandbox mode.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `?code=` exchange on success page; **409** → processing UI + checkout-context poll (cart not cleared); expired code → explicit error. |
| **Orders** | `GET /api/orders/access-exchange/:code` for email links; legacy URL tokens deprecated. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel without refund. |
| **Activity** | Consent-gated batch including `contact_submit`. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation success copy. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Prerequisites

- Backend running with `PAYPAL_MODE=sandbox`
- Sandbox buyer account from PayPal Developer Dashboard
- At least one in-stock product in the database

---

## Test flow

1. Add product to cart on storefront.
2. Go to checkout, fill customer/shipping details.
3. Click PayPal — redirected to sandbox PayPal.
4. Log in with sandbox buyer credentials and approve.
5. Redirected to `/payment/success?code=...&token=...` — frontend redeems `code` via `GET /api/paypal/checkout-exchange/:code` to obtain the access token, then capture runs automatically.
6. On success: cart clears, confirmation UI, URL stripped to `/payment/success`.
7. If capture returns **409**: processing UI appears (cart unchanged); page polls checkout-context until order completes or user visits `/orders`.
8. If exchange `code` is expired/used: explicit error with order lookup / support guidance (alternate recovery: `?aid=` + checkout-context when available).
9. Verify order in admin dashboard (`payment_status: completed`).

---

## Checkout exchange

`create-payment` returns `serverOrderId` and PayPal approval links but **does not** return the access token. The token is delivered only when the success page redeems the one-time `code` from the PayPal return URL. Each code is single-use, expires in 30 minutes, and is stored hashed with the token encrypted at rest.

---

## Verify server behavior

- Pending order created before PayPal redirect
- Stock decremented on create-payment
- Stock restored if payment abandoned (pending order expires after TTL)
- Confirmation email sent after capture
- Order lookup works with access token from email (`POST /api/orders/lookup`)
- Capture returns **409** if PayPal capture succeeds but the database order is not `payment_status=completed`
- Webhook `PAYMENT.CAPTURE.COMPLETED` reconciles amount (PayPal API fallback when missing) and returns **500** on reconciliation failure so PayPal retries

---

## Test refunds

1. Admin dashboard → cancel completed order with refund enabled.
2. Or `POST /api/paypal/refund/:captureId` as admin.

---

## Troubleshooting

See [diagnose-paypal-issue.md](./diagnose-paypal-issue.md).
