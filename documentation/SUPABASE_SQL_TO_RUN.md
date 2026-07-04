# Supabase SQL Scripts

SQL scripts to initialize and maintain the Lab Door Customs database.

**Full reference:** [`info.md`](info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

---

## Production Supabase status

**All required database migrations are applied** on the Lab Door Customs Supabase project (operator-confirmed, June 2026). Set `BOOTSTRAP_SKIP_DDL=true` on Railway so boot skips redundant DDL.

| Category | Status |
|----------|--------|
| Base schema + incremental migrations | Applied — see list in [Migration audit](#migration-audit-production-vs-new-databases) |
| `migration-performance-linter-fixes.sql` | Applied — FK indexes + consolidated RLS policies (lint 0001 / 0006) |
| `migration-products-search-trgm.sql` | Applied — `pg_trgm` + product search GIN indexes |
| `migration-admin-enhancements.sql` | Applied — SKU, reorder point, `inventory_movements`, `order_line_items`, admin notes |
| `migration-remove-product-category.sql` | Applied — dropped `products.category`, `order_line_items.category`; coupon scope `all` / `product` only (July 2026) |
| `migration-drop-reviews.sql` | **Pending** — drops `reviews`, `review_votes`, and rating trigger (July 2026 feature removal) |
| `migration-drop-paypal.sql` | Applied — legacy payment tables/columns removed (July 2026) |
| `migration-products-video-360.sql` | Applied — `products.video_360` |
| RLS + grant revoke migrations | Applied |
| Payment / exchange tables | Applied (`payment_idempotency`, `order_access_exchanges`) |

Re-running any migration file is safe (`IF NOT EXISTS`). Use the verification queries below only for **new environments** (staging clones) or periodic audits.

---

## How the database is accessed

The Express backend is the sole application client. It connects with **service_role** credentials via `DATABASE_URL`. RLS policies restrict all **10** application tables to `service_role`; `anon` and `authenticated` PostgREST access is revoked. Catalog, orders, and admin data are served only through `/api/*` routes.

## Remove product reviews (run once)

After deploying the code that removes `/api/reviews` and the storefront reviews UI, run in the Supabase SQL Editor:

**File:** `backend/src/database/migration-drop-reviews.sql`

```sql
DROP TRIGGER IF EXISTS trigger_update_product_rating ON public.reviews;
DROP FUNCTION IF EXISTS public.update_product_rating();

DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Service role can manage all reviews" ON public.reviews;
DROP POLICY IF EXISTS "Service role manages reviews" ON public.reviews;
DROP POLICY IF EXISTS "Service role can manage review votes" ON public.review_votes;
DROP POLICY IF EXISTS "Service role manages review_votes" ON public.review_votes;

DROP TABLE IF EXISTS public.review_votes;
DROP TABLE IF EXISTS public.reviews;
```

**Verify** (expect 0 rows):

```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename IN ('reviews', 'review_votes');
```

`products.rating` and `products.review_count` columns remain as static catalog fields (seed values); no trigger updates them after this migration.

## Schema files

Located in `backend/src/database/`:

- `schema.sql` — base schema
- `migration-*.sql` — incremental migrations
- `migration-rls-tighten.sql` — RLS reference (boot applies idempotently via `ensureRlsPolicies()`)
- `migration-rls-sensitive-tables.sql` — RLS on coupons, coupon_usage, payment_idempotency, order_access_exchanges (skips tables not created yet)
- `migration-revoke-graphql-client-roles.sql` — revoke `anon`/`authenticated` grants (fixes GraphQL linter 0026/0027)
- `migration-order-access-exchange.sql` — one-time order tracking link codes (email; no token in URL)
- `migration-order-access-token-encrypted.sql` — `orders.access_token_encrypted` for durable post-capture email link minting
- `migration-ldcoff10-coupon.sql` — optional seed for storefront promo code **LDCOFF10** (10% off; customer must apply at checkout)
- `migration-performance-linter-fixes.sql` — FK indexes (lint 0001) + consolidate duplicate RLS policies (lint 0006). **Applied on production Supabase.** Run once on new DBs.
- `migration-products-search-trgm.sql` — `pg_trgm` + GIN indexes on `products.name` / `products.description` for `POST /api/products/search`. **Applied on production Supabase.** Run once on new DBs.
- `migration-products-video-360.sql` — optional `products.video_360` TEXT for admin-uploaded 360° MP4 URLs. Also applied at boot via `ensureProductVideo360Column()`.
- `migration-products-public-id.sql` — `products.public_id` UUID for storefront URLs (`/product/{public_id}`). Also applied at boot via `ensureProductPublicIdColumn()`.
- `migration-admin-enhancements.sql` — SKU, reorder point, `inventory_movements`, `order_line_items`, customer/order admin notes. Also applied at boot via `ensureAdminEnhancementSchema()`.
- `migration-remove-product-category.sql` — drops shoe `category` columns and category-scoped coupon scope. **Applied on production Supabase** (July 2026). Include on fresh DBs after `migration-admin-enhancements.sql` (or use updated `schema.sql` without category columns).
- `migration-drop-reviews.sql` — drops `reviews`, `review_votes`, and `update_product_rating()` trigger. **Run on existing DBs** when removing the reviews feature.
- `migration-drop-paypal.sql` — legacy payment cleanup. **Applied on production Supabase** (July 2026).
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

- `payment_idempotency`, `order_access_exchanges`
- `orders.access_token_encrypted`, customer soft-delete columns

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
-- FK indexes (lint 0001) — expect 1 row
SELECT indexname, tablename
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN ('idx_coupon_usage_order_id');

-- Consolidated service_role policies (lint 0006) — expect 4 rows (reviews removed)
SELECT tablename, policyname
FROM pg_policies
WHERE schemaname = 'public'
  AND policyname IN (
    'Service role manages activity_logs',
    'Service role manages admin_sessions',
    'Service role manages contact_messages',
    'Service role manages orders'
  )
ORDER BY tablename;
```

**Applied when:** both queries return the expected row counts.

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

All required migrations from `backend/src/database/` are applied on production. **Do not re-run** unless a verification query below fails.

| File | Notes |
|------|--------|
| `schema.sql` + migrations 1–15 in the audit table | Core tables, RLS, payment/exchange, admin enhancements |
| `migration-performance-linter-fixes.sql` | FK indexes + consolidated RLS (lint 0001 / 0006) |
| `migration-products-search-trgm.sql` | `pg_trgm` + product search GIN indexes |
| `migration-admin-enhancements.sql` | Inventory, SKU, order line items, admin notes |
| `migration-remove-product-category.sql` | Dropped shoe category columns; coupon scope `all` / `product` only |
| `migration-products-video-360.sql` | `products.video_360` |

**Optional (not required for launch):** `migration-ldcoff10-coupon.sql`, `seed.sql`.

### Verify in SQL editor — new databases only

On a **fresh** Supabase project, run files in order when the audit query returns no rows. Production is complete; skip this section unless cloning a new environment.

| Order | File | What to check |
|-------|------|----------------|
| 1 | `schema.sql` | Core tables (`products`, `orders`, `customers`, …) |
| 2 | `migration-activity-logs.sql` | `activity_logs` (if not in base schema) |
| 3 | `migration-add-size-color.sql` | Columns `products.size`, `products.color` |
| 4b | `migration-products-video-360.sql` | Column `products.video_360` (360° MP4) |
| 4c | `migration-admin-enhancements.sql` | SKU, reorder point, `inventory_movements`, `order_line_items`, admin notes |
| 4d | `migration-remove-product-category.sql` | Drop `products.category`, `order_line_items.category`; coupon scope `all`/`product` only |
| 5 | `migration-soft-delete-users.sql` | `customers.is_deleted`, `customers.deleted_at` |
| 6 | `migration-order-access-exchange.sql` | Table `order_access_exchanges` |
| 7 | `migration-order-access-token-encrypted.sql` | Column `orders.access_token_encrypted` |
| 8 | `migration-payment-idempotency.sql` | Table `payment_idempotency` |
| 9 | `migration-rls-sensitive-tables.sql` | RLS on coupons, idempotency, exchanges |
| 10 | `migration-revoke-graphql-client-roles.sql` | Revoked `anon`/`authenticated` grants |
| 11 | `migration-rls-drop-authenticated-policies.sql` | Only if legacy authenticated policies remain |
| 12 | `migration-rls-tighten.sql` | Reference only — boot `ensureRlsPolicies()` mirrors this |

**Legacy (skip on current production):** `migration-order-access-token.sql` — superseded by exchange + encrypted token migrations.

### Usually applied by backend boot (production complete via SQL editor)

Production has these objects from migrations; boot only patches gaps when `BOOTSTRAP_SKIP_DDL` is not set:

- `payment_idempotency`, `order_access_exchanges`
- `orders.access_token_encrypted`
- Customer soft-delete columns
- Idempotency partial index (`ensureIdempotencyIndexes()`)

Set `BOOTSTRAP_SKIP_DDL=true` after schema is stable so boot does not repeat heavy DDL.

### Optional

| File | Purpose |
|------|---------|
| `migration-ldcoff10-coupon.sql` | Seed promo **LDCOFF10** |
| `seed.sql` | Sample products (dev/demo) |

### Quick production audit

```sql
-- Feature tables (expect 3 rows when fully migrated — reviews + legacy payment tables removed)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'activity_logs',
    'order_access_exchanges',
    'payment_idempotency'
  )
ORDER BY tablename;

-- Performance migrations (expect 3 indexes + pg_trgm)
SELECT indexname FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_coupon_usage_order_id',
    'idx_products_name_trgm', 'idx_products_description_trgm'
  );

SELECT extname FROM pg_extension WHERE extname = 'pg_trgm';

-- Consolidated RLS (expect 6 policies)
SELECT tablename, policyname FROM pg_policies
WHERE schemaname = 'public'
  AND policyname LIKE 'Service role manages%'
ORDER BY tablename;

-- DB-RLS-10: all 10 client-revoked application tables present (expect 10 rows)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'products', 'orders', 'contact_messages',
    'coupons', 'coupon_usage', 'payment_idempotency',
    'order_access_exchanges', 'customers',
    'activity_logs', 'admin_sessions'
  )
ORDER BY tablename;

-- DB-RLS-10: RLS enabled on all 10 (expect 10 rows)
SELECT c.relname AS tablename
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relrowsecurity
  AND c.relname IN (
    'products', 'orders', 'contact_messages',
    'coupons', 'coupon_usage', 'payment_idempotency',
    'order_access_exchanges', 'customers',
    'activity_logs', 'admin_sessions'
  )
ORDER BY tablename;

-- products.video_360 column (expect 1 row after migration or boot)
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'products'
  AND column_name = 'video_360';
```

See also [PRE_LAUNCH_CHECKLIST.md](./PRE_LAUNCH_CHECKLIST.md) Phase 1.
