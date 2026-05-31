# Project Overview

**Authoritative reference:** [`../info.md`](../info.md)

Lab Door Customs is a monorepo e-commerce platform for custom footwear sales.

---

## Components

| Component | Location | Role |
|-----------|----------|------|
| Storefront SPA | `frontend/` | React 19 + Vite — browse, cart, checkout, policies |
| REST API | `backend/` | Express + TypeScript — orders, PayPal, admin, cache |
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
4. After PayPal approval, `POST /api/paypal/capture-payment` completes payment and sends email.
5. Admin fulfills order via dashboard — status updates, shipping notification.

---

## Security model

- **Admin:** HttpOnly session cookie, bcrypt password, server-side session validation.
- **Customers:** Per-order access tokens (hashed) for order lookup and payment capture.
- **API:** CSRF on mutating requests, rate limits, CORS whitelist, Cloudflare proxy in production.
- **PayPal:** Webhook signature verification, amount validation, idempotent create/capture/refund.

---

## Deployment

- Backend and frontend deploy as separate Railway services.
- Cloudflare sits in front in production (`TRUST_CLOUDFLARE=true`).
- CI validates builds with production-like environment variables and runs Vitest + Playwright.

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md).
