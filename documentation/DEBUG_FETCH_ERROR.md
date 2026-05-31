# API Fetch Debugging

Diagnose CORS, CSRF, and network errors between frontend and backend.

**Full reference:** [`../info.md`](../info.md)

---

## CORS errors

**Symptom:** Browser console shows "blocked by CORS policy"

**Checks:**

1. `FRONTEND_URL` on backend matches exact storefront origin (including https, no trailing slash mismatch).
2. Frontend `VITE_API_BASE_URL` points to correct API host.
3. Requests include `credentials: 'include'` (handled by `apiFetch`).

**Allowed origins:** `FRONTEND_URL` + localhost dev ports (5173, 3000).

---

## CSRF errors

**Symptom:** 403 response with "CSRF token missing" or "CSRF token invalid"

**Checks:**

1. Frontend calls `GET /api/csrf-token` before mutating requests (automatic in `apiFetch`).
2. Cookies enabled in browser (third-party cookie blocking can affect cross-origin setups).
3. `X-CSRF-Token` header present on POST/PUT/PATCH/DELETE.
4. On 403, frontend retries once after refreshing token.

**Cross-origin setup:** CSRF token cached in memory via `initCsrfToken()`.

---

## Network / timeout errors

**Symptom:** "Request timed out after 15000ms"

**Checks:**

1. Backend running and reachable at `VITE_API_BASE_URL`.
2. `REQUEST_TIMEOUT_MS` on backend (default 15s).
3. Database connection healthy (`GET /api/health`).

---

## 401 / 403 on admin routes

**Symptom:** Admin dashboard API calls fail

**Checks:**

1. Admin session cookie present (`admin_session`).
2. Session not expired (24h TTL) — log in again.
3. `credentials: 'include'` on fetch requests.

---

## 502 / 503 from backend

**Checks:**

1. Railway service running.
2. Redis connected (required in production).
3. Database reachable.
4. Check `/api/health` for component status.

---

## Debugging steps

1. Open browser DevTools → Network tab.
2. Inspect failing request: headers, cookies, response body.
3. Check backend Pino logs using `X-Request-Id` from response headers.
4. Verify env vars match between frontend build and backend deploy.

---

## Local development

```
Frontend: http://localhost:5173
Backend:  http://localhost:5000
VITE_API_BASE_URL=http://localhost:5000/api
FRONTEND_URL=http://localhost:5173
```

Both servers must be running simultaneously.
