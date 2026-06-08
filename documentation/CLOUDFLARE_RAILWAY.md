# Cloudflare + Railway

Production network setup for Lab Door Customs.

**Full reference:** [`info.md`](info.md)

---


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** -> processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_submit` on contact success. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Overview

The storefront and API share one public origin. Cloudflare proxies traffic to a single Railway service. The backend enforces Cloudflare-only access with `TRUST_CLOUDFLARE=true`.

```
Browser → Cloudflare → Railway (Express: /api/* + React SPA)
```

---

## Cloudflare configuration

### DNS records

| Type | Name | Target | Proxy |
|------|------|--------|-------|
| CNAME | `www` | Railway service (repo root) | Proxied (orange) |

An apex (`@`) record can point to the same Railway service if required by your DNS provider.

### SSL/TLS

- Mode: **Full (strict)** recommended
- Railway provides TLS termination; Cloudflare connects over HTTPS

### Security

- Enable WAF rules as needed
- Consider bot fight mode for admin paths
- Direct Railway URL access is blocked when `TRUST_CLOUDFLARE=true` (except `/api/health`)

---

## Backend Cloudflare middleware

File: `backend/src/middleware/cloudflare.ts`

When `TRUST_CLOUDFLARE=true`:

1. Requests must arrive from Cloudflare IP ranges (or hit `/api/health`).
2. Client IP is read from the `CF-Connecting-IP` header.
3. Used for rate limiting and activity log anonymization.

---

## Railway service

| Setting | Value |
|---------|-------|
| Root directory | repository root |
| Build | `npm install && npm run build` |
| Start | `npm start` |
| Health check | `/api/health` |

Environment variables: [DEPLOYMENT.md](./DEPLOYMENT.md)

---

## CORS and cookies

`FRONTEND_URL` must match the public site origin:

```
FRONTEND_URL=https://www.labdoorcustoms.com
```

In production the SPA and API are same-origin (`/api`), so browser requests use relative paths and HttpOnly cookies work without cross-origin CORS for normal storefront traffic.

---

## PayPal webhooks

Webhook URL on the public domain:

```
https://www.yourdomain.com/api/paypal/webhook
```

PayPal sends requests without a browser `Origin` header — allowed for the webhook path only.

---

## Troubleshooting

| Symptom | Check |
|---------|-------|
| 403 from API in production | Request going through Cloudflare? `TRUST_CLOUDFLARE=true`? |
| Wrong client IP in logs | `CF-Connecting-IP` header present? |
| Webhook 401 | `PAYPAL_WEBHOOK_ID` correct; raw body parser active |
| Storefront 404 on refresh | `frontend/dist` built; `SERVE_FRONTEND` not `false` |

See [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md) for HTTPS and DNS details.
