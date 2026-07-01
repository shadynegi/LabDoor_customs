# Project Overview

**Authoritative reference:** [`info.md`](info.md)

Lab Door Customs is a monorepo e-commerce platform for custom footwear sales.

---

## Components

| Component | Location | Role |
|-----------|----------|------|
| Monorepo root | `package.json` | npm workspaces; `dev`, `build`, `start`, `test` |
| Storefront SPA | `frontend/` | React 19 + Vite — browse, cart, checkout, policies |
| Server | `backend/` | Express + TypeScript — API, static SPA, checkout, admin, cache |
| Tests | `Tests/` | Vitest unit/API tests, Playwright smoke tests |
| Database | Supabase PostgreSQL | Products, orders, customers, sessions |
| Checkout | WhatsApp ordering | Place-order API + admin payment confirmation |
| Cache | Redis | Product cache, distributed rate limits |
| Email | Resend | Order confirmations, shipping, contact replies |
| Monitoring | Pino + Sentry | Structured logs and error tracking |

---

## Data flow

1. Customer browses products via Express API (Redis-cached list/detail) and **server-side search** (`POST /api/products/search` with debounced UI on Home and `/products`).
2. Cart stored in browser localStorage; each change triggers `POST /api/products/validate-cart` to refresh server prices and stock.
3. Checkout calls `POST /api/checkout/place-order` — server validates cart, creates pending order, reserves stock and coupon, returns `whatsappUrl`.
4. Browser redirects to WhatsApp with a pre-filled message; customer sends payment details off-site.
5. Admin finds order by **Order ID** (UUID from WhatsApp message) or order number, **Mark paid** when payment confirmed; fulfills via dashboard — tracking, shipping notification, validated status transitions, bulk updates (max 500 IDs).

---

## Security model

- **Admin:** HttpOnly session cookie, bcrypt password (`ADMIN_PASSWORD_HASH`), SHA-256 hashed sessions in DB.
- **Customers:** Per-order access tokens (SHA-256 hashed + AES-256-GCM encrypted at rest); email links use one-time `order_access_exchanges` codes.
- **Database:** Supabase PostgreSQL with service_role-only RLS on 14 tables; anon/authenticated PostgREST access revoked.
- **API:** CSRF on mutating requests (except activity batch), rate limits, CORS whitelist, Cloudflare proxy in production.
- **Activity:** Consent-gated on frontend; IP anonymized with `IP_SALT`; batch endpoint CSRF-exempt.
- **Checkout:** Server-side pricing validation; place-order idempotency; pending order expiry.

---

## Deployment

- One Railway service at the repository root serves API and storefront.
- Cloudflare proxies the public domain (`TRUST_CLOUDFLARE=true`).
- CI validates builds with production-like environment variables and runs Vitest + Playwright.

See [DEPLOYMENT.md](./DEPLOYMENT.md) and [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md).
