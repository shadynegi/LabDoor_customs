# Production Readiness Checklist

Verify Lab Door Customs is ready for production.

**Full reference:** [`info.md`](info.md) | **Deploy:** [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)


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

## Backend

- [ ] `DATABASE_URL`, `FRONTEND_URL`, `ADMIN_PASSWORD_HASH` set
- [ ] `PAYPAL_WEBHOOK_ID`, `PAYPAL_MODE=live`, live credentials
- [ ] `REDIS_URL`, `SENTRY_DSN`, `TRUST_CLOUDFLARE=true`
- [ ] `GET /api/health` returns all components healthy

## Frontend

- [ ] `VITE_API_BASE_URL`, `VITE_SITE_URL`, `VITE_SENTRY_DSN` set at build
- [ ] Sitemap builds with product URLs
- [ ] PayPal sandbox/live mode matches backend

## Infrastructure

- [ ] Cloudflare DNS + SSL (Full strict) — [SSL_DNS_CHECKLIST.md](./SSL_DNS_CHECKLIST.md)
- [ ] PayPal webhook registered — [PAYPAL_SETUP_GUIDE.md](./PAYPAL_SETUP_GUIDE.md)
- [ ] Resend email configured
- [ ] Search Console verified — [SEARCH_CONSOLE_SETUP.md](./SEARCH_CONSOLE_SETUP.md)

## Functional smoke test

- [ ] Browse products, add to cart, complete PayPal checkout
- [ ] Order confirmation email received
- [ ] Admin login, view order, update status
- [ ] Customer order lookup with token
