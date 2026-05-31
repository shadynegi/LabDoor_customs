# Deployment Guide

**Authoritative reference:** [`../info.md`](../info.md) — environment variables and CI/CD.

Deploy Lab Door Customs to production using Railway (backend + frontend) with Cloudflare in front.

---

## Architecture

```
User → Cloudflare (DNS + proxy) → Railway frontend (static SPA)
                               → Railway backend (Express API)
                               → Supabase PostgreSQL
                               → Redis
                               → PayPal (live)
                               → Resend (email)
                               → Sentry (errors)
```

---

## Backend (Railway)

1. Create a Railway service from the `backend/` directory.
2. Set **start command:** `npm run build && npm start`
3. Set **healthcheck path:** `/api/health`

### Required environment variables

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase pooler URL (port 6543) |
| `FRONTEND_URL` | `https://www.labdoorcustoms.com` |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash of admin password |
| `PAYPAL_CLIENT_ID` | Live PayPal client ID |
| `PAYPAL_SECRET` | Live PayPal secret |
| `PAYPAL_MODE` | `live` |
| `PAYPAL_WEBHOOK_ID` | PayPal webhook ID |
| `TRUST_CLOUDFLARE` | `true` |
| `REDIS_URL` | Redis connection string |
| `SENTRY_DSN` | Sentry backend DSN |
| `JWT_SECRET` | 32+ character secret |
| `RESEND_API_KEY` | Resend API key |

### Recommended

| Variable | Purpose |
|----------|---------|
| `DB_SSL_CA_PATH` | Supabase CA certificate |
| `SENTRY_RELEASE` | Git commit SHA for Sentry releases |
| `PENDING_ORDER_TTL_HOURS` | Abandoned checkout TTL (default 24) |

---

## Frontend (Railway)

1. Create a Railway service from the `frontend/` directory.
2. Set **build command:** `npm run build`
3. Set **start command:** `npm start` (serves `dist/`)

### Required build-time variables

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `CI` | `true` (or rely on NODE_ENV) |
| `VITE_API_BASE_URL` | `https://api.yourdomain.com/api` |
| `VITE_SITE_URL` | `https://www.yourdomain.com` |
| `VITE_SENTRY_DSN` | Sentry frontend DSN |
| `SITEMAP_REQUIRE_PRODUCTS` | `true` (default in prod builds) |

The build runs `validate-env.mjs` → `generate-sitemap.mjs` → TypeScript → Vite.

### Optional

| Variable | Purpose |
|----------|---------|
| `VITE_GA4_MEASUREMENT_ID` | Google Analytics |
| `VITE_GSC_VERIFICATION` | Search Console verification |
| `VITE_SENTRY_RELEASE` | Sentry release tag |

---

## Cloudflare

See [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md).

- Proxy both frontend and API domains through Cloudflare (orange cloud).
- Backend requires `TRUST_CLOUDFLARE=true` — direct Railway URL access is blocked except `/api/health`.

---

## PayPal webhooks

1. In PayPal Developer Dashboard (live mode), create a webhook pointing to:
   `https://api.yourdomain.com/api/paypal/webhook`
2. Subscribe to: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`, `PAYMENT.CAPTURE.REVERSED`
3. Set `PAYPAL_WEBHOOK_ID` on the backend service.

---

## GitHub CI secrets

| Secret | Used by |
|--------|---------|
| `PRODUCTION_API_BASE_URL` | Frontend build, sitemap job |
| `VITE_SENTRY_DSN` | Frontend build |
| `DATABASE_URL` | Supabase keep-alive cron |

---

## Post-deploy checks

1. `GET https://api.yourdomain.com/api/health` — DB and Redis healthy
2. Browse storefront — products load from API
3. Complete a sandbox/live test order
4. Admin login and dashboard analytics
5. Verify `https://www.yourdomain.com/sitemap.xml` contains product URLs
6. Submit sitemap in Google Search Console

See also: [DEPLOYMENT.md](./DEPLOYMENT.md), [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md)
