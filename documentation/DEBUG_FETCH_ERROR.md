# API Fetch Debugging

Diagnose CORS, CSRF, and network errors between the storefront and API.

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

## Debugging steps

1. Browser DevTools → Network tab.
2. Inspect failing request: headers, cookies, response body.
3. Backend Pino logs filtered by `X-Request-Id`.
4. Env vars consistent between frontend build and server runtime.

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
