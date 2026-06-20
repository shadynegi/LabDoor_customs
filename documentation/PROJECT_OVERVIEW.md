# Project Overview

**Authoritative reference:** [`info.md`](info.md)

Lab Door Customs is a monorepo e-commerce platform for custom footwear sales.

---

## Components

| Component | Location | Role |
|-----------|----------|------|
| Monorepo root | `package.json` | npm workspaces; `dev`, `build`, `start`, `test` |
| Storefront SPA | `frontend/` | React 19 + Vite — browse, cart, checkout, policies |
| Server | `backend/` | Express + TypeScript — API, static SPA, PayPal, admin, cache |
| Tests | `Tests/` | Vitest unit/API tests, Playwright smoke tests |
| Database | Supabase PostgreSQL | Products, orders, customers, sessions |
| Payments | PayPal Checkout | Create, capture, webhooks, refunds |
| Cache | Redis | Product cache, distributed rate limits |
| Email | Resend | Order confirmations, shipping, contact replies |
| Monitoring | Pino + Sentry | Structured logs and error tracking |

---

## Data flow

1. Customer browses products via Express API (Redis-cached list/detail) and **server-side search** (`POST /api/products/search` with debounced UI on Home and `/products`).
2. Cart stored in browser localStorage; each change triggers `POST /api/products/validate-cart` to refresh server prices and stock.
3. Checkout calls `POST /api/paypal/create-payment` — server validates cart, creates pending order, reserves stock and coupon, binds PayPal order, issues a one-time checkout exchange code.
4. PayPal redirects to `/payment/success?code=...&token=...`; PaymentSuccess redeems the code via `GET /api/paypal/checkout-exchange/:code` for the order access token, then `POST /api/paypal/capture-payment` (with `serverOrderId` + `accessToken`) completes payment.
5. Admin fulfills order via dashboard — tracking, shipping notification, validated status transitions, bulk updates (max 500 IDs), optional manual mark paid (`admin_note` + `payment_id`).

---

## Security model

- **Admin:** HttpOnly session cookie, bcrypt password (`ADMIN_PASSWORD_HASH`), SHA-256 hashed sessions in DB.
- **Customers:** Per-order access tokens (SHA-256 hashed at rest); PayPal return uses one-time exchange codes (AES-256-GCM encrypted in `order_checkout_exchanges`).
- **Database:** Supabase PostgreSQL with service_role-only RLS on 14 tables; anon/authenticated PostgREST access revoked.
- **API:** CSRF on mutating requests (except activity batch and PayPal webhook), rate limits, CORS whitelist, Cloudflare proxy in production.
- **Activity:** Consent-gated on frontend; IP anonymized with `IP_SALT`; batch endpoint CSRF-exempt.
- **PayPal:** Webhook signature verification, amount validation, idempotent create/capture/refund.

---

## Deployment

- One Railway service at the repository root serves API and storefront.
- Cloudflare proxies the public domain (`TRUST_CLOUDFLARE=true`).
- CI validates builds with production-like environment variables and runs Vitest + Playwright.

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md).
