# Supabase SQL Scripts

SQL scripts to initialize and maintain the Lab Door Customs database.

**Full reference:** [`info.md`](info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

---

## How the database is accessed

The Express backend is the sole application client. It connects with **service_role** credentials via `DATABASE_URL`. RLS policies restrict all 14 application tables to `service_role`; `anon` and `authenticated` PostgREST access is revoked. Catalog, orders, and admin data are served only through `/api/*` routes.

## Schema files

Located in `backend/src/database/`:

- `schema.sql` — base schema
- `migration-*.sql` — incremental migrations
- `migration-rls-tighten.sql` — RLS reference (boot applies idempotently via `ensureRlsPolicies()`)
- `migration-rls-sensitive-tables.sql` — RLS on coupons, coupon_usage, payment_idempotency, processed_refund_events (skips tables not created yet)
- `migration-revoke-graphql-client-roles.sql` — revoke `anon`/`authenticated` grants (fixes GraphQL linter 0026/0027) + fix `update_product_rating` search_path (lint 0011)
- `migration-order-access-exchange.sql` — one-time order tracking link codes (email; no token in URL)
- `migration-order-checkout-exchange.sql` — PayPal return checkout exchange codes (`order_checkout_exchanges`)
- `migration-order-access-token-encrypted.sql` — `orders.access_token_encrypted` for durable post-capture email link minting
- `migration-performance-linter-fixes.sql` — **run once manually:** FK indexes (lint 0001) + consolidate duplicate RLS policies (lint 0006) on `activity_logs`, `reviews`, `admin_sessions`, `contact_messages`, `orders`, `review_votes`
- `migration-payment-idempotency.sql` — idempotency table + indexes including partial index `idx_payment_idempotency_processing_created` for maintenance reaper

## Boot vs SQL editor

| What | SQL editor (once) | Server boot (every start) |
|------|-------------------|---------------------------|
| Base tables | `schema.sql`, migrations | Skip-if-exists when `BOOTSTRAP_SKIP_DDL=true` |
| RLS lint 0006 cleanup | `migration-performance-linter-fixes.sql` | Skipped (use `BOOTSTRAP_FORCE_RLS=true` only if intentional) |
| Idempotency partial index | In `migration-payment-idempotency.sql` | `ensureIdempotencyIndexes()` creates IF NOT EXISTS |
| Runtime tables | Optional manual | `ensureIdempotencyTable()`, etc. |

Runtime tables also patched at boot when not skipped:

- `payment_idempotency`, `processed_refund_events`, `order_checkout_exchanges`, `order_access_exchanges`
- `orders.refunded_amount`, `orders.access_token_encrypted`, customer soft-delete columns, PayPal unique indexes

## Running SQL

1. Open Supabase SQL Editor or connect via psql with direct URI (port 5432).
2. Run migration files in order.
3. Run `migration-performance-linter-fixes.sql` once if Supabase linter reports duplicate policies (0006).
4. Set `BOOTSTRAP_SKIP_DDL=true` in backend `.env` after schema is applied.
5. Verify with `GET /api/health` after backend restart.

See [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md) for a guided walkthrough.
