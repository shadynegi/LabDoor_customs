# Row-Level Security

How Lab Door Customs uses Supabase RLS and database grants.

**Full reference:** [`info.md`](info.md)

---

## Architecture

Production routes **all** data access through the Express API using `DATABASE_URL` with the Supabase **service_role** (or equivalent postgres superuser). The storefront never uses the Supabase JS client against public tables. RLS and revoked grants block direct PostgREST/GraphQL access from `anon` and `authenticated` roles.

---

## Tables and access model

### Service-role-only RLS (14 tables)

`ensureRlsPolicies()` (`backend/src/lib/rlsMigration.ts`) runs on every server start but is **non-destructive** when policies already exist:

| Table | Policy |
|-------|--------|
| `products` | Service role manages products |
| `orders` | Service role manages orders |
| `contact_messages` | Service role manages contact_messages |
| `coupons`, `coupon_usage` | Service role manages {table} |
| `customers`, `activity_logs`, `admin_sessions` | Service role manages {table} |
| `reviews`, `review_votes` | Service role manages reviews / review_votes |
| `payment_idempotency`, `processed_refund_events`, `order_checkout_exchanges`, `order_access_exchanges` | Service role manages {table} |

There is **no** public read policy on `products` via PostgREST. Catalog data is served only through `GET /api/products` and related Express routes.

### Boot behavior (current)

1. If marker tables already have any `Service role%` policy → **skip entire RLS step** (log: `skipping rls_policies`).
2. Otherwise enable RLS, grant `service_role`, create unified policies **only when missing**.
3. Revoke `anon`/`authenticated` grants only when those grants still exist.
4. **Does not** DROP legacy policies on boot (avoids Supabase pooler lock hangs). Use one-time SQL or `BOOTSTRAP_FORCE_RLS=true` (not recommended on production restarts).

### Revoked client roles

`migration-revoke-graphql-client-roles.sql` revokes `ALL` on application tables from `anon` and `authenticated`, then grants `ALL` to `service_role`. Boot applies revokes only when client grants are still present.

Legacy permissive policies (authenticated product writes, public product read, etc.) are removed by **`migration-performance-linter-fixes.sql`** (run once in Supabase SQL editor) — not on every restart.

---

## SQL scripts (manual run)

| File | Purpose |
|------|------|
| `migration-rls-sensitive-tables.sql` | RLS on runtime-sensitive tables (skips missing tables) |
| `migration-revoke-graphql-client-roles.sql` | Revoke anon/authenticated; fix `update_product_rating` search_path |
| `migration-performance-linter-fixes.sql` | **Recommended once:** FK indexes (lint 0001); consolidate duplicate RLS policies (lint 0006) |
| `migration-rls-tighten.sql` | Reference SQL mirroring boot migration |

Re-run `migration-rls-sensitive-tables.sql` after first production boot if runtime tables (`payment_idempotency`, etc.) were created after the initial SQL run.

---

## Failure behavior

In production, `ensureRlsPolicies()` failure prevents server startup when using Supabase (unless `ALLOW_INSECURE_RLS=true`). In development, bootstrap may continue with a warning; API is ready immediately by default while RLS runs in the background.

**Recommended after schema is in Supabase:** set `BOOTSTRAP_SKIP_DDL=true` in `backend/.env` to avoid redundant DDL on every dev restart.
