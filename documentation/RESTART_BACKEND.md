# Restart Server

How to restart the Lab Door Customs application server.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; `policy_accepted` required; **Place Order** → `POST /api/checkout/place-order` → WhatsApp redirect (`Order ID` in message = `orders.id` UUID); checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Dashboard search includes order id UUID, order number, email, name; **Mark paid** with external `payment_id` + admin note; **Settings** tab (no contact inbox). |
| **Activity** | Consent-gated batch; `contact_submit` on contact success; IPs anonymized with `IP_SALT`. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
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
| `[withRetry] transient failure` | DB connection blip (e.g. `ECONNRESET`, `CONNECT_TIMEOUT`); includes operation `label` |
| `Bootstrap: skipping …` | Schema/RLS already applied — normal with `BOOTSTRAP_SKIP_DDL` |
| `Core bootstrap complete — deferred RLS/cache tasks may still be running in background` | Dev only — API is up; `Deferred bootstrap complete` follows when RLS/cache finish |
| `Maintenance: step finished` | Initial maintenance step completed with `durationMs` |
| `Maintenance: skipped (database unreachable)` | Scheduled cleanup skipped after ping/retry failed — common after laptop sleep; **not** proof of wrong `DATABASE_URL` if startup succeeded |

Filter by `X-Request-Id` header or `requestId` field in logs. Set `LOG_LEVEL=debug` locally for health-check noise at debug level only.

**Full reference:** [`info.md`](info.md) — [Logging and monitoring](info.md#logging-and-monitoring), [Server startup and bootstrap](info.md#server-startup-and-bootstrap).
