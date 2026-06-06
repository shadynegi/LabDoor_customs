# Deployment Guide

Production deployment for Lab Door Customs on Railway with Cloudflare.

**Full reference:** [`info.md`](info.md) | **Go-live:** [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) | **Deploy:** [DEPLOYMENT.md](./DEPLOYMENT.md)

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
- [ ] `PAYPAL_*` — live credentials + `PAYPAL_WEBHOOK_ID`
- [ ] `TRUST_CLOUDFLARE=true`
- [ ] `REDIS_URL` — Redis instance
- [ ] `SENTRY_DSN` — backend error tracking
- [ ] `JWT_SECRET` — 32+ characters
- [ ] `RESEND_API_KEY` — transactional email
- [ ] `ORDER_TOKEN_ENCRYPTION_KEY` — checkout exchange token encryption
- [ ] `IP_SALT` — activity IP anonymization and review voter IDs
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
