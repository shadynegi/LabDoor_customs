# Deployment

Production deployment for Lab Door Customs on Railway with Cloudflare.

**Full reference:** [`../info.md`](../info.md) | **Extended guide:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)

---

## Services

| Service | Platform | Directory | Port |
|---------|----------|-----------|------|
| API | Railway | `backend/` | 5000 |
| Storefront | Railway | `frontend/` | 5173 (serve) |

Both services sit behind Cloudflare DNS proxy in production.

---

## Backend deploy checklist

- [ ] `NODE_ENV=production`
- [ ] `DATABASE_URL` — Supabase pooler (6543)
- [ ] `FRONTEND_URL` — public storefront HTTPS URL
- [ ] `ADMIN_PASSWORD_HASH` — bcrypt hash (use `POST /api/admin/generate-hash`)
- [ ] `PAYPAL_*` — live credentials + `PAYPAL_WEBHOOK_ID`
- [ ] `TRUST_CLOUDFLARE=true`
- [ ] `REDIS_URL` — Redis instance connected at startup
- [ ] `SENTRY_DSN` — backend error tracking
- [ ] `JWT_SECRET` — 32+ characters
- [ ] `RESEND_API_KEY` — transactional email
- [ ] Healthcheck: `/api/health`

---

## Frontend deploy checklist

- [ ] `VITE_API_BASE_URL` — production API HTTPS URL
- [ ] `VITE_SITE_URL` — canonical storefront URL
- [ ] `VITE_SENTRY_DSN` — frontend error tracking
- [ ] Sitemap generated with live product URLs (`SITEMAP_REQUIRE_PRODUCTS=true`)
- [ ] Optional: `VITE_GA4_MEASUREMENT_ID`, `VITE_GSC_VERIFICATION`

Build pipeline: `validate-env` → `sitemap` → `tsc` → `vite build` → `serve -s dist`

---

## Cloudflare

- Orange-cloud proxy for frontend and API subdomains
- SSL mode: Full (strict) recommended
- Backend blocks non-Cloudflare traffic when `TRUST_CLOUDFLARE=true`

Details: [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md)

---

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs on push/PR:

- Backend build + Vitest
- Frontend build (requires secrets) + Playwright E2E
- Sitemap generation with live API
- Documentation link check

Configure secrets: `PRODUCTION_API_BASE_URL`, `VITE_SENTRY_DSN`, `DATABASE_URL`.

---

## Monitoring

- **Logs:** Railway log drain or Pino JSON stdout
- **Errors:** Sentry (backend + frontend)
- **Uptime:** External ping on `/api/health`
- **Supabase:** GitHub cron keep-alive every 6 days
