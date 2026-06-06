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

The server automatically:

- Connects to Redis (required in production)
- Applies schema patches (idempotency, refund events, checkout exchange tables)
- Warms product cache
- Starts maintenance jobs (order expiry, idempotency cleanup, checkout exchange cleanup)
- Serves `frontend/dist` when present in production

---

## Logs

Check Railway logs or stdout for Pino JSON output. Filter by `X-Request-Id` for specific requests.
