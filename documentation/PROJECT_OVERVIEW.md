# Project Overview

**Authoritative reference:** [`../info.md`](../info.md)

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

1. Customer browses products (cached API + client-side Fuse search).
2. Cart stored in browser localStorage.
3. Checkout calls `POST /api/paypal/create-payment` — server creates pending order, reserves stock, opens PayPal.
4. PayPal redirects to `/payment/success?code=...&token=...`; frontend redeems the code via `GET /api/paypal/checkout-exchange/:code`, then `POST /api/paypal/capture-payment` completes payment.
5. Admin fulfills order via dashboard — tracking, shipping notification, status updates, optional manual mark paid.

---

## Security model

- **Admin:** HttpOnly session cookie, bcrypt password, SHA-256 hashed sessions in DB.
- **Customers:** Per-order access tokens (hashed at rest); PayPal return uses one-time exchange codes.
- **API:** CSRF on mutating requests, rate limits, CORS whitelist, Cloudflare proxy in production.
- **PayPal:** Webhook signature verification, amount validation, idempotent create/capture/refund.

---

## Deployment

- One Railway service at the repository root serves API and storefront.
- Cloudflare proxies the public domain (`TRUST_CLOUDFLARE=true`).
- CI validates builds with production-like environment variables and runs Vitest + Playwright.

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md).
