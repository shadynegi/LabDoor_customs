# Row-Level Security

How Lab Door Customs uses Supabase RLS and database grants.

**Full reference:** [`info.md`](info.md)

---

## Architecture

Production routes **all** data access through the Express API using `DATABASE_URL` with the Supabase **service_role** (or equivalent postgres superuser). The storefront never uses the Supabase JS client against public tables. RLS and revoked grants block direct PostgREST/GraphQL access from `anon` and `authenticated` roles.

---

## Tables and access model

### Service-role-only RLS (13 tables)

At boot, `ensureRlsPolicies()` (`backend/src/lib/rlsMigration.ts`) enables RLS and creates `service_role` policies on:

| Table | Policy |
|-------|--------|
| `products` | Service role manages products |
| `orders` | Service role manages orders |
| `contact_messages` | Service role manages contact_messages |
| `coupons`, `coupon_usage` | Service role manages {table} |
| `customers`, `activity_logs`, `admin_sessions` | Service role manages {table} |
| `reviews`, `review_votes` | Service role manages reviews / review_votes |
| `payment_idempotency`, `processed_refund_events`, `order_checkout_exchanges` | Service role manages {table} |

There is **no** public read policy on `products` via PostgREST. Catalog data is served only through `GET /api/products` and related Express routes.

### Revoked client roles

`migration-revoke-graphql-client-roles.sql` (also applied at boot) revokes `ALL` on all 13 tables from `anon` and `authenticated`, then grants `ALL` to `service_role`. This addresses Supabase linter warnings for unintended GraphQL exposure.

Legacy permissive policies (authenticated product writes, public product read, customer order read, etc.) are dropped at startup. Supabase lint **0006** (multiple permissive policies) is addressed by removing older per-action names such as `Service role can create orders` in favor of a single `Service role manages {table}` policy per table; `ensureRlsPolicies()` applies the same drops on boot.

---

## SQL scripts (manual run)

| File | Purpose |
|------|------|
| `migration-rls-sensitive-tables.sql` | RLS on runtime-sensitive tables (skips missing tables) |
| `migration-revoke-graphql-client-roles.sql` | Revoke anon/authenticated; fix `update_product_rating` search_path |
| `migration-performance-linter-fixes.sql` | FK indexes; consolidate duplicate RLS policies (lint 0006) |
| `migration-rls-tighten.sql` | Reference SQL mirroring boot migration |

Re-run `migration-rls-sensitive-tables.sql` after first production boot if runtime tables (`payment_idempotency`, etc.) were created after the initial SQL run.

---

## Failure behavior

In production, `ensureRlsPolicies()` failure prevents server startup. In development, a non-Supabase database may log a warning and continue.
