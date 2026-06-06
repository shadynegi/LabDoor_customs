# SSL and DNS Checklist

HTTPS and DNS configuration for production.

**Full reference:** [`info.md`](info.md) | **Cloudflare:** [CLOUDFLARE_RAILWAY.md](./CLOUDFLARE_RAILWAY.md)

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

## DNS

- [ ] Public domain (`www`) → Cloudflare → Railway service (repository root)
- [ ] Record proxied (orange cloud)

---

## SSL/TLS

- [ ] Cloudflare SSL mode: Full (strict)
- [ ] Railway service serves HTTPS behind Cloudflare
- [ ] Backend enforces HTTPS redirect via `x-forwarded-proto` in production

---

## Backend TLS to database

- [ ] `DB_SSL_CA_PATH` set to Supabase CA bundle
- [ ] `DB_SSL_REJECT_UNAUTHORIZED` defaults to true

---

## Environment

- [ ] `FRONTEND_URL=https://www.yourdomain.com`
- [ ] `VITE_API_BASE_URL=/api`
- [ ] `VITE_SITE_URL=https://www.yourdomain.com`
- [ ] `TRUST_CLOUDFLARE=true`

---

## Verify

- [ ] `https://www.yourdomain.com` loads the storefront
- [ ] `https://www.yourdomain.com/api/health` returns 200
- [ ] `https://www.yourdomain.com/sitemap.xml` is reachable
- [ ] No mixed content warnings in the browser console
