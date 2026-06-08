# Restart Server

How to restart the Lab Door Customs application server.

**Full reference:** [`info.md`](info.md)

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

## Local development

**API only:**

```bash
cd backend
# Ctrl+C to stop, then:
npm run dev
```

**Full stack (API + Vite):**

```bash
# Ctrl+C to stop, then from repository root:
npm run dev
```

**Production-like (API + static SPA):**

```bash
npm run build
cd backend && SERVE_FRONTEND=true npm start
```

---

## Production (Railway)

1. Open Railway dashboard → service linked to the repository root.
2. Click **Restart** or redeploy from the latest commit.
3. Verify: `GET https://www.yourdomain.com/api/health`

---

## After restart

The server automatically on **every start**:

1. **Bootstrap** — DB ping, schema checks (skip-if-exists with `BOOTSTRAP_SKIP_DDL`), RLS verification, cache warm
2. **Maintenance timers** — first run after `MAINTENANCE_DEFER_MS` (default 2 min), then hourly / 15‑min intervals
3. **Redis** — connect in production (required)
4. **Static SPA** — serves `frontend/dist` when present in production

In **development**, the API is ready immediately; bootstrap and maintenance continue in the background. After Supabase schema is applied, set `BOOTSTRAP_SKIP_DDL=true` in `backend/.env` for fast restarts.

---

## Logs

Check Railway logs or stdout for Pino output (pretty-printed in dev, JSON in production).

| Log message | Meaning |
|-------------|---------|
| `Request started` / `Request finished` | HTTP lifecycle with `requestId`, path, duration, status |
| `Request timeout` | Route exceeded `REQUEST_TIMEOUT_MS` or `SLOW_REQUEST_TIMEOUT_MS`; includes `elapsedMs` and pool stats |
| `[withRetry] transient failure` | DB connection blip (e.g. `ECONNRESET`); includes operation `label` |
| `Bootstrap: skipping …` | Schema/RLS already applied — normal with `BOOTSTRAP_SKIP_DDL` |
| `Maintenance: step finished` | Background cleanup step with `durationMs` |

Filter by `X-Request-Id` header or `requestId` field in logs. Set `LOG_LEVEL=debug` locally for health-check noise at debug level only.

**Full reference:** [`info.md`](info.md) — [Logging and monitoring](info.md#logging-and-monitoring), [Server startup and bootstrap](info.md#server-startup-and-bootstrap).
