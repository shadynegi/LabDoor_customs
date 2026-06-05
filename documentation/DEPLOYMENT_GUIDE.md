# Deployment Guide

Production deployment for Lab Door Customs on Railway with Cloudflare.

**Full reference:** [`../info.md`](../info.md) | **Checklist:** [DEPLOYMENT.md](./DEPLOYMENT.md)

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
