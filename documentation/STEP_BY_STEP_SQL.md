# Step-by-Step SQL

Run database schema and migrations for Lab Door Customs.

**Full reference:** [`info.md`](info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 14 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart in localStorage; PayPal checkout exchange `?code=`; order tracking links use `GET /api/orders/access-exchange/:code` (no token in email URL); capture requires `serverOrderId` + `accessToken`. |
| **Admin** | Bulk updates max **500** IDs; manual mark paid verifies PayPal capture via API; paid orders cannot cancel without refund; product cards on mobile. |
| **Activity** | `POST /api/activity/batch` is CSRF-exempt and rate-limited; frontend sends only with analytics cookie consent; IPs anonymized with `IP_SALT`. |
| **Reviews** | Public responses strip PII (`toPublicReview()`); admin shows email. Eligibility via `POST /api/reviews/check` (email in body). Votes on approved reviews only. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Prerequisites

- Supabase project created
- Direct connection URI (port 5432) from [GET_DATABASE_URL.md](./GET_DATABASE_URL.md)

## Steps

1. Connect to Supabase SQL Editor.
2. Run `backend/src/database/schema.sql`, then incremental files in `backend/src/database/migration-*.sql` (see [`SUPABASE_SQL_TO_RUN.md`](./SUPABASE_SQL_TO_RUN.md)).
3. Confirm core tables exist: `products`, `orders`, `order_items`, `customers`, `coupons`, `reviews`, `contact_messages`, `order_access_exchanges`, plus payment/runtime tables (`idempotency_keys`, `refund_events`, etc.).
4. Set `DATABASE_URL` to pooler URI (6543) on backend.
5. Start backend — runtime schema patches apply automatically for incremental DDL.

## Verify

```bash
curl http://localhost:5000/api/health
```

Should report database connected.
