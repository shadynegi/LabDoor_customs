# API Fetch Debugging

Diagnose CORS, CSRF, and network errors between the storefront and API.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** → processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. 
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_form_submit` on contact success. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## CORS errors

**Symptom:** Browser console shows "blocked by CORS policy"

**Checks:**

1. `FRONTEND_URL` on the backend matches the browser origin (scheme, host, no trailing slash).
2. `VITE_API_BASE_URL` is `/api` in production (same origin) or points to the correct API host in dev.
3. Requests include `credentials: 'include'` (handled by `apiFetch`).

**Development origins allowed:** `FRONTEND_URL`, localhost ports 5173 and 3000, and LAN IPs on those ports.

---

## CSRF errors

**Symptom:** 403 response with "CSRF token missing" or "CSRF token invalid"

**Checks:**

1. Frontend calls `GET /api/csrf-token` before mutating requests (automatic in `apiFetch`).
2. Cookies enabled in the browser.
3. `X-CSRF-Token` header present on POST/PUT/PATCH/DELETE.
4. On CSRF 403, frontend retries once after refreshing the token.

---

## Network / timeout errors

**Symptom:** "Request timed out after 60000ms" (or 180000ms on slow routes)

**Checks:**

1. Backend running and reachable.
2. `REQUEST_TIMEOUT_MS` on backend (default 60s). Slow routes use `SLOW_REQUEST_TIMEOUT_MS` (default 180s): `/api/products*`, `/api/admin/analytics`, `/api/activity/*`.
3. `VITE_EXTENDED_API_TIMEOUT_MS` on frontend for `slowApiFetch` / catalog reads (default 180s). General `apiFetch` default is 60s (`VITE_API_TIMEOUT_MS`).
3. Database healthy (`GET /api/health`).

---

## 401 / 403 on admin routes

**Symptom:** Admin dashboard API calls fail

**Checks:**

1. `admin_session` cookie present.
2. Session not expired (24h TTL).
3. `credentials: 'include'` on fetch requests.

---

## 502 / 503 from backend

**Checks:**

1. Railway service running.
2. Redis connected (required in production).
3. Database reachable.
4. `/api/health` component status.

---

## 504 Gateway Timeout

**Symptom:** API returns 504; backend log shows `Request timeout` with `elapsedMs` near `timeoutMs`.

**Checks:**

1. Supabase project awake (free tier pauses after inactivity — run keep-alive or wake via dashboard).
2. `DATABASE_URL` uses pooler port **6543** with `pgbouncer=true`.
3. Log `pool` stats on timeout — high `activeConnections` may indicate pool exhaustion.
4. Catalog/admin routes use 180s timeout (`SLOW_REQUEST_TIMEOUT_MS`); others use 60s (`REQUEST_TIMEOUT_MS`).
5. After laptop sleep, restart dev server — stale pooler connections may show `ECONNRESET` in `[withRetry]` logs.

---

## ECONNRESET / admin dashboard errors

**Symptom:** `read ECONNRESET` on admin analytics or session validation.

**Checks:**

1. Restart backend after idle period.
2. Confirm Supabase reachable: `GET /api/health`.
3. Backend retries transient DB errors automatically; check `[withRetry]` logs for `label` (e.g. `adminAnalytics:order_stats`).

---

## Debugging steps

1. Browser DevTools → Network tab.
2. Inspect failing request: headers, cookies, response body, `X-Request-Id`.
3. Backend logs: match `requestId` from `Request started` → `Request finished` or `Request timeout`.
4. Set `LOG_LEVEL=debug` in `backend/.env` for full request lifecycle.
5. Env vars consistent between frontend build and server runtime.

---

## Local development

```
npm run dev          # from repository root
Storefront:         http://localhost:5173
API (direct):       http://localhost:5000
API (via Vite):     http://localhost:5173/api

frontend/.env:      VITE_API_BASE_URL=/api
backend/.env:       FRONTEND_URL=http://localhost:5173
```

**Production-like local server:**

```
npm run build
cd backend && SERVE_FRONTEND=true npm start
# → http://localhost:5000 (API and SPA on one port)
```
