# Deployment Guide

Production deployment for Lab Door Customs on Railway with Cloudflare.

**Full reference:** [`info.md`](info.md) | **Go-live:** [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | **Deploy:** [DEPLOYMENT.md](./DEPLOYMENT.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 10 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | WhatsApp links pre-fill `?orderId=` on `/orders`; lookup via order ID + checkout email (`POST /api/orders/lookup`); full reload clears lookup form; legacy access-exchange returns **410**; lookup failure message **Order not found**. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Service topology

| Component | Platform | Root | Port |
|-----------|----------|------|------|
| API + storefront | Railway | repository root | `PORT` (default 5000) |

One Express process serves `/api/*` and the React SPA (`frontend/dist`). Cloudflare proxies the public domain in production.

---

## Deploy checklist

### Runtime (Railway environment)

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` — Supabase pooler (6543)
- [ ] `FRONTEND_URL` — public site URL (`https://www.yourdomain.com`)
- [ ] `ADMIN_USERNAME` — admin login username
- [ ] `ADMIN_PASSWORD_HASH` — bcrypt hash (`node backend/scripts/generate-admin-hash.mjs "password"`)
- [ ] `WHATSAPP_CONTACT_NUMBER` — store WhatsApp contact (E.164)
- [ ] `TRUST_CLOUDFLARE=true`
- [ ] `REDIS_URL` — Redis instance
- [ ] `SENTRY_DSN` — backend error tracking
- [ ] `JWT_SECRET` — 32+ characters
- [ ] `ORDER_TOKEN_ENCRYPTION_KEY` — order access token encryption
- [ ] `IP_SALT` — activity IP anonymization
- [ ] Healthcheck: `/api/health`

### Build-time (same Railway service)

- [ ] `VITE_API_BASE_URL=/api`
- [ ] `VITE_SITE_URL` — canonical storefront URL
- [ ] `VITE_SENTRY_DSN` — frontend error tracking
- [ ] Optional: `SITEMAP_API_BASE_URL` — live API URL for product URLs in sitemap during build
- [ ] Optional: `VITE_GA4_MEASUREMENT_ID`, `VITE_GSC_VERIFICATION`

Build command (from [`railway.json`](../railway.json)): `npm install && npm run build`  
Start command: `npm start`

---

## Cloudflare

- Orange-cloud proxy on the public domain
- SSL mode: Full (strict) recommended
- Direct Railway URL access is blocked when `TRUST_CLOUDFLARE=true` (except `/api/health`)

Details: [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md)

---

## CI

GitHub Actions (`.github/workflows/ci.yml`):

| Job | Purpose |
|-----|---------|
| monorepo | Root install, validate-env, build, Vitest, Playwright smoke |
| sitemap | Live product URLs via `PRODUCTION_API_BASE_URL` secret |
| links | Documentation link checker |

Secrets: `PRODUCTION_API_BASE_URL`, `VITE_SENTRY_DSN`, `DATABASE_URL`.

---

## Monitoring

- **Logs:** Railway log drain or Pino JSON stdout
- **Errors:** Sentry (backend + frontend)
- **Uptime:** External ping on `/api/health`
- **Supabase:** GitHub cron keep-alive every 6 days
