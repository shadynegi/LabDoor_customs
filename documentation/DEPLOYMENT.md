# Deployment Guide

**Authoritative reference:** [`info.md`](info.md) — environment variables and CI/CD.

Deploy Lab Door Customs from the repository root on Railway. Express serves the API (`/api/*`) and the built React storefront (`frontend/dist`) on one host.

**Before first production traffic:** complete [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md).

---

## Architecture

```
User → Cloudflare (DNS + proxy) → Railway (Express API + static SPA)
                               → Supabase PostgreSQL
                               → Redis
                               → WhatsApp (customer order messages)
                               → WhatsApp Cloud API (optional customer notifications)
                               → Sentry (errors)
```

| Path | Handler |
|------|---------|
| `/api/*` | Express REST API |
| `/*` | React SPA (`frontend/dist`) with client-side routing fallback |

---

## Railway

1. Link a Railway service to the **repository root**.
2. Railway reads [`railway.json`](../railway.json):
   - **Build:** `npm install && npm run build`
   - **Start:** `npm start`
   - **Healthcheck:** `/api/health`
3. Set environment variables on the service (runtime + build).

### Required environment variables

| Variable | Value |
|----------|-------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase pooler URL (port 6543) |
| `FRONTEND_URL` | `https://www.labdoorcustoms.com` (same public URL as the Railway service) |
| `ADMIN_PASSWORD_HASH` | Bcrypt hash — `node backend/scripts/generate-admin-hash.mjs "password"` |
| `ADMIN_USERNAME` | Primary admin login username |
| `WHATSAPP_CONTACT_NUMBER` | Store WhatsApp contact (required in production) |
| `TRUST_CLOUDFLARE` | `true` |
| `REDIS_URL` | Redis connection string |
| `SENTRY_DSN` | Sentry backend DSN |
| `JWT_SECRET` | 32+ characters with mixed case, number, and special character |
| `ORDER_TOKEN_ENCRYPTION_KEY` | AES-256-GCM key for order access token encryption |
| `IP_SALT` | Salt for activity IP anonymization |

### Required build-time variables (frontend Vite build)

Set these on the same Railway service so `npm run build` can compile the SPA:

| Variable | Value |
|----------|-------|
| `VITE_API_BASE_URL` | `/api` (same-origin API) |
| `VITE_SITE_URL` | `https://www.labdoorcustoms.com` |
| `VITE_SENTRY_DSN` | Sentry frontend DSN |
| `VITE_WHATSAPP_CONTACT_NUMBER` | Same value as `WHATSAPP_CONTACT_NUMBER` |

The frontend build runs `validate-env.mjs` → `generate-sitemap.mjs` → TypeScript → Vite. In production, Express automatically serves `frontend/dist` when `index.html` exists.

### Optional

| Variable | Purpose |
|----------|---------|
| `BOOTSTRAP_SKIP_DDL` | Skip CREATE TABLE/INDEX on boot when schema already in Supabase |
| `MAINTENANCE_DEFER_MS` | Delay first maintenance run (default 120000) |
| `LOG_LEVEL` | `debug` / `info` / `warn` / `error` |
| `REQUEST_LOG_SLOW_MS` | Warn on slow HTTP requests (default 3000) |
| `SERVE_FRONTEND` | `false` to disable static hosting (API-only mode); auto-enabled in production when dist exists |
| `FRONTEND_DIST_PATH` | Override path to built SPA (default: `frontend/dist`) |
| `DB_SSL_CA_PATH` | Supabase CA certificate |
| `VITE_GA4_MEASUREMENT_ID` | Google Analytics |
| `ADMIN_ADDITIONAL_USERS` | Optional JSON array of extra admin accounts `[{"username","passwordHash"}]` |
| `SITEMAP_REQUIRE_PRODUCTS` | Fail build if sitemap has zero products |

Validate locally before deploy:

```bash
npm install
CI_VALIDATE_PRODUCTION=true TRUST_CLOUDFLARE=true ... npm run validate-env -w backend
VITE_API_BASE_URL=/api VITE_SITE_URL=https://www.example.com VITE_SENTRY_DSN=... npm run build
```

---

## Cloudflare

See [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md).

- Proxy the public domain through Cloudflare (orange cloud).
- `TRUST_CLOUDFLARE=true` blocks direct Railway URL access except `/api/health`.

---

## WhatsApp checkout

Customers complete payment off-site via WhatsApp after `POST /api/checkout/place-order`. See [WHATSAPP_CHECKOUT_GUIDE.md](./WHATSAPP_CHECKOUT_GUIDE.md).

- Set `WHATSAPP_CONTACT_NUMBER` (backend) and `VITE_WHATSAPP_CONTACT_NUMBER` (frontend build) to your store WhatsApp number (E.164).
- Admin confirms payment via **Mark paid** in the dashboard.

---

## GitHub CI secrets

| Secret | Used by |
|--------|---------|
| `PRODUCTION_API_BASE_URL` | Sitemap job (live product URLs during CI) |
| `VITE_SENTRY_DSN` | Monorepo production build |
| `DATABASE_URL` | Supabase keep-alive cron |

---

## Health and Redis

`GET /api/health` reports database latency, Redis connectivity, and uptime. Returns **503** in production when Redis is required but disconnected.

---

## Post-deploy checks

1. `GET https://www.labdoorcustoms.com/api/health` — DB and Redis healthy
2. `GET https://www.labdoorcustoms.com/` — storefront loads
3. Complete a test order (place-order → WhatsApp → admin mark paid)
4. Admin login at `/admin/login`
5. Verify `/sitemap.xml` contains product URLs

See also: [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md)
