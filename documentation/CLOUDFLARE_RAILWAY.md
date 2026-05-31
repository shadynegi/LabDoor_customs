# Cloudflare + Railway

Production network setup for Lab Door Customs.

**Full reference:** [`../info.md`](../info.md)

---

## Overview

In production, both the storefront and API are accessed through Cloudflare DNS proxy. The backend enforces this with `TRUST_CLOUDFLARE=true`.

```
Browser → Cloudflare → Railway (frontend SPA)
                     → Railway (backend API)
```

---

## Cloudflare configuration

### DNS records

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `www` | Railway frontend service | Proxied (orange) |
| CNAME | `api` | Railway backend service | Proxied (orange) |

### SSL/TLS

- Mode: **Full (strict)** recommended
- Railway provides TLS termination; Cloudflare connects over HTTPS

### Security

- Enable WAF rules as needed
- Consider bot fight mode for admin paths
- Backend blocks direct Railway URL access when `TRUST_CLOUDFLARE=true` (except `/api/health`)

---

## Backend Cloudflare middleware

File: `backend/src/middleware/cloudflare.ts`

When `TRUST_CLOUDFLARE=true`:

1. Requests must arrive from Cloudflare IP ranges (or hit `/api/health`).
2. Client IP is read from `CF-Connecting-IP` header instead of socket address.
3. Used for rate limiting and activity log anonymization.

Direct access to the Railway backend URL returns blocked unless the path is `/api/health`.

---

## Railway services

### Backend

- Root directory: `backend/`
- Build: `npm run build`
- Start: `npm start`
- Health check: `/api/health`
- Environment: see [DEPLOYMENT.md](./DEPLOYMENT.md)

### Frontend

- Root directory: `frontend/`
- Build: `npm run build` (includes sitemap generation)
- Start: `npm start` (serves `dist/`)

---

## CORS

Backend `FRONTEND_URL` must match the public storefront origin:

```
FRONTEND_URL=https://www.labdoorcustoms.com
```

CORS allows credentials (cookies) from this origin only.

---

## PayPal webhooks

Webhook URL must point to the Cloudflare-proxied API domain:

```
https://api.yourdomain.com/api/paypal/webhook
```

PayPal sends requests without browser Origin header — allowed for webhook path only.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 403 from API in production | Request going through Cloudflare? `TRUST_CLOUDFLARE=true`? |
| Wrong client IP in logs | `CF-Connecting-IP` header present? |
| CORS errors | `FRONTEND_URL` matches actual storefront URL |
| Webhook 401 | `PAYPAL_WEBHOOK_ID` correct; raw body parser active |

See [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md) for HTTPS and DNS details.
