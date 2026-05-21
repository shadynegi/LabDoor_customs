# SSL / DNS Production Checklist — Lab Door Customs

Use this checklist when deploying the API (`backend/`) and frontend (`frontend/`) on Railway (or any reverse-proxy host). The backend enforces HTTPS in production via `x-forwarded-proto` and sets HSTS + secure cookies when `NODE_ENV=production`.

---

## 1. Environment variables

| Variable | Production example | Notes |
|----------|-------------------|--------|
| `NODE_ENV` | `production` | Enables HTTPS redirect, HSTS, secure cookies |
| `FRONTEND_URL` | `https://www.yourdomain.com` | Must be **https** — used for CORS + CSP |
| `PUBLIC_HOST` | `api.yourdomain.com` | Optional fallback for 301 redirect host header |
| `PORT` | `5000` | Railway sets this automatically |

**Frontend** (`frontend/.env`):

| Variable | Production example |
|----------|-------------------|
| `VITE_API_BASE_URL` | `https://api.yourdomain.com/api` |
| `VITE_BACKEND_URL` | `https://api.yourdomain.com` |

See `backend/env.template` and `frontend/env.template`.

---

## 2. Railway TLS

1. Open Railway project → **Settings** → **Networking** / **Domains**.
2. Add custom domain for API service (e.g. `api.yourdomain.com`) and frontend service (e.g. `www.yourdomain.com`).
3. Railway provisions TLS certificates automatically once DNS propagates.
4. Confirm **HTTPS** is enabled (default on Railway public URLs).
5. Set `NODE_ENV=production` on both services.

---

## 3. DNS records

At your DNS provider (Cloudflare, Route53, etc.):

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| `CNAME` | `api` | `<railway-api-host>.up.railway.app` | API backend |
| `CNAME` | `www` | `<railway-frontend-host>.up.railway.app` | React SPA |

Or `A` records if Railway provides static IPs (uncommon on Railway — prefer CNAME).

**Verify with dig:**

```bash
dig +short api.yourdomain.com
dig +short www.yourdomain.com
dig +short api.yourdomain.com CNAME
```

Expected: resolves to Railway hostname or edge IP. Allow up to 48h for TTL propagation (often minutes).

---

## 4. HTTP → HTTPS redirect (backend)

Production middleware returns **301** when `x-forwarded-proto: http`.

```bash
curl -I http://api.yourdomain.com/api/health
```

Expected:

```http
HTTP/1.1 301 Moved Permanently
Location: https://api.yourdomain.com/api/health
```

---

## 5. HSTS & security headers

```bash
curl -I https://api.yourdomain.com/api/health
```

Expected headers (among others):

- `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload`
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`

---

## 6. SSL Labs grade

1. Visit [https://www.ssllabs.com/ssltest/](https://www.ssllabs.com/ssltest/)
2. Enter `api.yourdomain.com` (and frontend host separately).
3. Target grade: **A** or **A+** (Railway-managed certs typically achieve A).

Remediation if below A:

- Ensure full chain is served (Railway handles this).
- Disable legacy TLS at CDN/proxy if you add Cloudflare in front.
- Enable “Full (strict)” SSL mode if using Cloudflare.

---

## 7. End-to-end smoke test

```bash
# API health
curl -s https://api.yourdomain.com/api/health | jq .

# CSRF + CORS (from browser or curl with Origin)
curl -s -c /tmp/cookies.txt https://api.yourdomain.com/api/csrf-token \
  -H "Origin: https://www.yourdomain.com"

# Frontend loads over HTTPS
curl -I https://www.yourdomain.com
```

---

## 8. Cookies (production)

| Cookie | `Secure` | `HttpOnly` | `SameSite` | Notes |
|--------|----------|------------|------------|-------|
| `csrf_token` | yes | **no** | `Lax` | SPA must read token for `X-CSRF-Token` header |

Admin auth uses `Authorization: Bearer` in `localStorage` (frontend) — not an HttpOnly session cookie.

---

## 9. Optional: direct TLS on Node (self-hosted)

If **not** using Railway TLS termination, set in `backend/.env`:

```env
SSL_KEY_PATH=/path/to/privkey.pem
SSL_CERT_PATH=/path/to/fullchain.pem
```

The server can then listen with `https.createServer` (see `backend/src/server.ts`). Most Railway deployments do **not** need this.

---

## 10. Sign-off

- [ ] DNS `dig` resolves for API + frontend hosts
- [ ] `curl -I http://api...` returns **301** to HTTPS
- [ ] `curl -I https://api...` shows HSTS header
- [ ] SSL Labs ≥ **A** for API host
- [ ] `FRONTEND_URL` and `VITE_*` URLs use **https**
- [ ] PayPal return URLs updated to production HTTPS paths

**Last verified:** _fill on deploy_
