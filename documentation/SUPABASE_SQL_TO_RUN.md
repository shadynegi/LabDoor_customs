# Supabase SQL Scripts

SQL scripts to initialize and maintain the Lab Door Customs database.

**Full reference:** [`info.md`](info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

---

## Production Supabase status

Both manual performance migrations are **applied** on the Lab Door Customs Supabase project (operator-confirmed, June 2026):

| Migration | Status |
|-----------|--------|
| `migration-performance-linter-fixes.sql` | Applied — FK indexes + consolidated RLS policies (lint 0001 / 0006) |
| `migration-products-search-trgm.sql` | Applied — `pg_trgm` + `idx_products_name_trgm` / `idx_products_description_trgm` |

Re-run either file is safe (`IF NOT EXISTS`). New environments (staging clones) must run them once; use the verification queries below to confirm.

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
- `migration-ldcoff10-coupon.sql` — optional seed for storefront promo code **LDCOFF10** (10% off; customer must apply at checkout)
- `migration-performance-linter-fixes.sql` — FK indexes (lint 0001) + consolidate duplicate RLS policies (lint 0006). **Applied on production Supabase.** Run once on new DBs.
- `migration-products-search-trgm.sql` — `pg_trgm` + GIN indexes on `products.name` / `products.description` for `POST /api/products/search`. **Applied on production Supabase.** Run once on new DBs.
- `migration-payment-idempotency.sql` — idempotency table + indexes including partial index `idx_payment_idempotency_processing_created` for maintenance reaper

## Boot vs SQL editor

| What | SQL editor (once) | Server boot (every start) |
|------|-------------------|---------------------------|
| Base tables | `schema.sql`, migrations | Skip-if-exists when `BOOTSTRAP_SKIP_DDL=true` |
| RLS lint 0006 cleanup | `migration-performance-linter-fixes.sql` (applied on prod) | Skipped (use `BOOTSTRAP_FORCE_RLS=true` only if intentional) |
| Product search indexes | `migration-products-search-trgm.sql` (applied on prod) | Not applied at boot |
| Idempotency partial index | In `migration-payment-idempotency.sql` | `ensureIdempotencyIndexes()` creates IF NOT EXISTS |
| Runtime tables | Optional manual | `ensureIdempotencyTable()`, etc. |

Runtime tables also patched at boot when not skipped:

- `payment_idempotency`, `processed_refund_events`, `order_checkout_exchanges`, `order_access_exchanges`
- `orders.refunded_amount`, `orders.access_token_encrypted`, customer soft-delete columns, PayPal unique indexes

## Running SQL

1. Open Supabase SQL Editor or connect via psql with direct URI (port 5432).
2. Run migration files in order.
3. On **new** databases, run `migration-performance-linter-fixes.sql` and `migration-products-search-trgm.sql` once (already applied on production).
4. Set `BOOTSTRAP_SKIP_DDL=true` in backend `.env` after schema is applied.
5. Verify with `GET /api/health` after backend restart (optional: run verification SQL below).

See [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md) for a guided walkthrough.

## Verify migrations applied

Run these in the Supabase SQL Editor to confirm migrations on any database (including periodic audits). On production Supabase both migrations are already applied; expect the row counts below.

### `migration-performance-linter-fixes.sql`

```sql
-- FK indexes (lint 0001) — expect 2 rows
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_coupon_usage_order_id', 'idx_reviews_order_id');

-- Consolidated service_role policies (lint 0006) — expect 6 rows
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'Service role manages activity_logs',
    'Service role manages reviews',
    'Service role manages admin_sessions',
    'Service role manages contact_messages',
    'Service role manages orders',
    'Service role manages review_votes'
  )
ORDER BY tablename;
```

**Applied when:** both queries return the expected row counts. If duplicate legacy policies remain (e.g. `Anyone can view approved reviews`), re-run the migration file.

### `migration-products-search-trgm.sql`

```sql
-- Extension — expect 1 row
SELECT extname, extversion FROM pg_extension WHERE extname = 'pg_trgm';

-- GIN indexes — expect 2 rows
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_products_name_trgm', 'idx_products_description_trgm');
```

**Applied when:** `pg_trgm` is installed and both indexes exist. The Express search route (`POST /api/products/search`) continues to use `ILIKE`; indexes speed `%query%` scans without API changes.

---

## Migration audit (production vs new databases)

Use this when deciding what still needs the SQL editor on **production** (verify first) vs a **fresh** Supabase project (run in order).

### Applied on production Supabase (June 2026)

| File | Do not re-run unless audit fails |
|------|----------------------------------|
| `migration-performance-linter-fixes.sql` | FK indexes + consolidated RLS (lint 0001 / 0006) |
| `migration-products-search-trgm.sql` | `pg_trgm` + product search GIN indexes |

### Verify in SQL editor — run file only if missing

On a live store, these are often already applied via earlier SQL or backend boot. Run the matching `.sql` file **only** when the audit query returns no rows.

| Order | File | What to check |
|-------|------|----------------|
| 1 | `schema.sql` | Core tables (`products`, `orders`, `customers`, …) |
| 2 | `migration-reviews.sql` | Tables `reviews`, `review_votes` |
| 3 | `migration-activity-logs.sql` | `activity_logs` (if not in base schema) |
| 4 | `migration-add-size-color.sql` | Columns `products.size`, `products.color` |
| 5 | `migration-soft-delete-users.sql` | `customers.is_deleted`, `customers.deleted_at` |
| 6 | `migration-order-access-exchange.sql` | Table `order_access_exchanges` |
| 7 | `migration-order-checkout-exchange.sql` | Table `order_checkout_exchanges` |
| 8 | `migration-order-access-token-encrypted.sql` | Column `orders.access_token_encrypted` |
| 9 | `migration-payment-idempotency.sql` | Table `payment_idempotency` |
| 10 | `migration-processed-refund-events.sql` | Table `processed_refund_events` |
| 11 | `migration-paypal-unique-refunds.sql` | Unique indexes on PayPal order/capture IDs |
| 12 | `migration-rls-sensitive-tables.sql` | RLS on coupons, idempotency, refund events |
| 13 | `migration-revoke-graphql-client-roles.sql` | Revoked `anon`/`authenticated` grants |
| 14 | `migration-rls-drop-authenticated-policies.sql` | Only if legacy authenticated policies remain |
| 15 | `migration-rls-tighten.sql` | Reference only — boot `ensureRlsPolicies()` mirrors this |

**Legacy (skip on current production):** `migration-order-access-token.sql` — superseded by exchange + encrypted token migrations.

### Usually applied by backend boot (not SQL editor)

If deploy logs show successful bootstrap and `GET /api/health` is OK, manual SQL for these is often unnecessary:

- `payment_idempotency`, `processed_refund_events`
- `order_checkout_exchanges`, `order_access_exchanges`
- `orders.refunded_amount`, `orders.access_token_encrypted`
- Customer soft-delete columns, PayPal unique indexes
- Idempotency partial index (`ensureIdempotencyIndexes()`)

Set `BOOTSTRAP_SKIP_DDL=true` after schema is stable so boot does not repeat heavy DDL.

### Optional

| File | Purpose |
|------|---------|
| `migration-ldcoff10-coupon.sql` | Seed promo **LDCOFF10** |
| `seed.sql` | Sample products (dev/demo) |

### Quick production audit

```sql
-- Feature tables (expect 7 rows when fully migrated)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'reviews', 'review_votes', 'activity_logs',
    'order_access_exchanges', 'order_checkout_exchanges',
    'payment_idempotency', 'processed_refund_events'
  )
ORDER BY tablename;

-- Performance migrations (expect 4 indexes + pg_trgm)
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_coupon_usage_order_id', 'idx_reviews_order_id',
    'idx_products_name_trgm', 'idx_products_description_trgm'
  );

SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';

-- Consolidated RLS (expect 6 policies)
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'Service role manages%'
ORDER BY tablename;
```

See also [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) Phase 1.
