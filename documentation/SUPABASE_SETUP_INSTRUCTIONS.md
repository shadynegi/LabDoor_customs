# Supabase Project Setup

Create and configure Supabase PostgreSQL for Lab Door Customs.

**Full reference:** [`info.md`](info.md) | **Database:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)


## Current system behavior

Lab Door Customs is a monorepo: React/Vite storefront (`frontend/`), Express API (`backend/`), Vitest + Playwright tests (`Tests/`). Production runs one Express process serving `/api/*` and the built SPA; PostgreSQL is Supabase with backend **service_role** access — RLS and revoked grants block `anon`/`authenticated` PostgREST on 13 tables.

| Area | How it works |
|------|----------------|
| **Checkout** | Cart validation with retry; PayPal `?code=` exchange; capture **409** -> processing UI; checkout email synced to activity on change/blur. |
| **Orders** | Email links `GET /api/orders/access-exchange/:code`; legacy `?orderNumber=&token=` stripped; partial refresh keeps stale data + warning. |
| **Admin** | Products paginated (load more); messages mark read on open; coupons scope UI; reviews admin response; estimated delivery; error/retry states. |
| **Activity** | Consent-gated batch; `contact_form_submit` on contact success. |
| **Reviews** | `POST /api/reviews/check` on email blur; pending-moderation copy; vote error toasts. |
| **Mobile** | Sticky CTAs with keyboard lift on checkout; cookie banner top on purchase routes; cart stacked CTA at 320px; OOS hides product sticky bar; admin product cards on phones. |

Authoritative reference: [`info.md`](info.md). Production requires `ORDER_TOKEN_ENCRYPTION_KEY`, `IP_SALT`, `ADMIN_PASSWORD_HASH`.

---

## Steps

1. Create a project at [supabase.com](https://supabase.com).
2. Note the project URL and service role key (backend only — never expose to frontend).
3. Copy the connection pooler URI (port 6543) for `DATABASE_URL`.
4. Run schema SQL from `backend/migrations/` or follow [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md).
5. Configure RLS if using Supabase client directly — see [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md).

## Connection

- **App runtime:** PgBouncer pooler on port 6543
- **Migrations:** Direct connection on port 5432
- **TLS:** Set `DB_SSL_CA_PATH` to Supabase CA bundle in production
