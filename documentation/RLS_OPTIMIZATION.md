# Row-Level Security

How Lab Door Customs uses Supabase RLS and database grants.

**Full reference:** [`info.md`](info.md)

---

## Architecture

Production routes **all** data access through the Express API using `DATABASE_URL` with the Supabase **service_role** (or equivalent postgres superuser). The storefront never uses the Supabase JS client against public tables. RLS and revoked grants block direct PostgREST/GraphQL access from `anon` and `authenticated` roles.

---

## Tables and access model

### Service-role-only RLS (10 tables)

`ensureRlsPolicies()` (`backend/src/lib/rlsMigration.ts`) runs on every server start but is **non-destructive** when policies already exist:

| Table | Policy |
|-------|--------|
| `products` | Service role manages products |
| `orders` | Service role manages orders |
| `contact_messages` | Legacy table (RLS retained; storefront contact form no longer writes rows) |
| `coupons`, `coupon_usage` | Service role manages {table} |
| `customers`, `activity_logs`, `admin_sessions` | Service role manages {table} |
| `payment_idempotency`, `order_access_exchanges` | Service role manages {table} |

There is **no** public read policy on `products` via PostgREST. Catalog data is served only through `GET /api/products` and related Express routes.

### Boot behavior (current)

1. If marker tables already have any `Service role%` policy → **skip entire RLS step** (log: `skipping rls_policies`).
2. Otherwise enable RLS, grant `service_role`, create unified policies **only when missing**.
3. Revoke `anon`/`authenticated` grants only when those grants still exist.
4. **Does not** DROP legacy policies on boot (avoids Supabase pooler lock hangs). Use one-time SQL or `BOOTSTRAP_FORCE_RLS=true` (not recommended on production restarts).

### Revoked client roles

`migration-revoke-graphql-client-roles.sql` revokes `ALL` on application tables from `anon` and `authenticated`, then grants `ALL` to `service_role`. Boot applies revokes only when client grants are still present.

Legacy permissive policies (authenticated product writes, public product read, etc.) are removed by **`migration-performance-linter-fixes.sql`** (applied on production Supabase; run once on new DBs) — not on every restart.

**Production status (July 2026):** All required SQL migrations in `backend/src/database/` are applied. Use verification queries in [SUPABASE_SQL_TO_RUN.md](./SUPABASE_SQL_TO_RUN.md) only for new databases or audits.

---

## SQL scripts (manual run)

| File | Purpose |
|------|------|
| `migration-rls-sensitive-tables.sql` | RLS on runtime-sensitive tables (skips missing tables) |
| `migration-revoke-graphql-client-roles.sql` | Revoke anon/authenticated; grant service_role on application tables |
| `migration-performance-linter-fixes.sql` | FK indexes (lint 0001); consolidate duplicate RLS policies (lint 0006). **Applied on production Supabase.** |
| `migration-products-search-trgm.sql` | `pg_trgm` GIN indexes on `products` for server search. **Applied on production Supabase.** |
| `migration-admin-enhancements.sql` | Inventory, order line items. **Applied on production Supabase.** |
| `migration-rls-tighten.sql` | Reference SQL mirroring boot migration |

Re-run `migration-rls-sensitive-tables.sql` after first production boot if runtime tables (`payment_idempotency`, etc.) were created after the initial SQL run.

---

## Failure behavior

In production, `ensureRlsPolicies()` failure prevents server startup when using Supabase (unless `ALLOW_INSECURE_RLS=true`). In development, bootstrap may continue with a warning; API is ready immediately by default while RLS runs in the background.

**Recommended after schema is in Supabase:** set `BOOTSTRAP_SKIP_DDL=true` in `backend/.env` to avoid redundant DDL on every dev restart.
