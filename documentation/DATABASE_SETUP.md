# Database Setup

PostgreSQL schema and migrations for Lab Door Customs on Supabase.

**Full reference:** [`info.md`](info.md)

---

## Connection

| Use case | Port | Notes |
|----------|------|-------|
| App server (production) | 6543 | PgBouncer pooler — `prepare: false` |
| Migrations / admin | 5432 | Direct connection |

```
DATABASE_URL=postgresql://postgres.PROJECT_REF:PASSWORD@aws-1-REGION.pooler.supabase.com:6543/postgres?pgbouncer=true
```

Production TLS: set `DB_SSL_CA_PATH` to Supabase CA bundle.

---

## Initial setup

1. Create a Supabase project.
2. Run `backend/src/database/schema.sql` in the SQL editor.
3. Optionally run `backend/src/database/seed.sql` for sample products.
4. Apply migration files in `backend/src/database/` as needed.
5. **Dev/staging only:** `npm run seed:test-data` — 10 `Test*` customers + 20 orders for admin dashboard/analytics QA (idempotent; order numbers `GSS-TEST-SEED-*`).

---

## Core tables

| Table | Purpose |
|-------|---------|
| `products` | Catalog — price, stock, optional `cost_price`, optional `video_360`; one row per shoe |
| `orders` | Orders — JSONB items/shipping, `payment_id`, payment/status enums |
| `customers` | Aggregated stats — total_orders, total_spent, soft delete |
| `coupons` | Discount rules — type, limits, scope (`applies_to`: `all` or `product` + IDs) |
| `coupon_usage` | Per-order coupon reservations |
| `contact_messages` | Legacy table (schema/RLS retained; storefront no longer writes — contact form opens WhatsApp client-side) |
| `activity_logs` | Client activity (anonymized IP) |
| `admin_sessions` | Admin session token hashes (SHA-256) |

---

## Payment tables

Created at server startup via `ensureIdempotencyTable()`, `ensureOrderPaymentSchema()`, and `ensureOrderAccessExchangeTable()`:

| Table | Purpose |
|-------|---------|
| `payment_idempotency` | Place-order deduplication |
| `order_access_exchanges` | One-time order tracking link codes (email) |

Migration files:

- `migration-payment-idempotency.sql` — table + indexes (including partial index for reaper)
- `migration-remove-product-category.sql` — drop shoe category columns; coupon scope `all` / `product` only (**applied on production Supabase**, July 2026)
- `migration-remove-product-variant-fields.sql` — drop legacy `sku`, `reorder_point`, `size`, `color` columns (**applied on production Supabase**, July 2026; also applied at boot via `ensureProductVariantFieldsRemoved()`)
- `migration-drop-reviews.sql` — drop `reviews` / `review_votes` and rating trigger (**applied on production Supabase**, July 2026)
- `migration-drop-paypal.sql` — legacy payment cleanup (**applied on production Supabase**, July 2026)

Boot creates missing indexes via `ensureIdempotencyIndexes()` even when `BOOTSTRAP_SKIP_DDL=true`.

---

## Orders table highlights

| Column | Purpose |
|--------|---------|
| `payment_id` | External payment reference (admin **Mark paid** for WhatsApp orders) |
| `access_token_hash` | SHA-256 hash of customer access token |
| `access_token_encrypted` | Encrypted token for durable tracking-link minting |
| `items` | JSONB line items |
| `shipping_address` | JSONB shipping details |

---

## Row-level security

`ensureRlsPolicies()` runs at startup (`backend/src/lib/rlsMigration.ts`; see also `migration-rls-tighten.sql`, `migration-rls-sensitive-tables.sql`, `migration-revoke-graphql-client-roles.sql`).

- **10 tables** have RLS with service_role-only policies (including `order_access_exchanges`).
- **`anon` and `authenticated` grants are revoked** — no public product catalog via PostgREST/GraphQL.
- Boot is **non-destructive** when policies exist. **Production Supabase:** all required migrations applied (July 2026), including performance linter fixes, product search indexes, reviews removal, variant-field cleanup, and PayPal legacy cleanup.
- The Express backend connects with **service_role** credentials for all API operations.

Set `BOOTSTRAP_SKIP_DDL=true` on production after migrations are applied.

See [RLS_OPTIMIZATION.md](./RLS_OPTIMIZATION.md).

---

## Maintenance

Scheduled after **core** bootstrap (`maintenanceJobs.ts`); initial run deferred by `MAINTENANCE_DEFER_MS` (default 120s):

| Interval | Tasks |
|----------|--------|
| Once after defer | DB ping → expire stale orders → reap stuck idempotency keys |
| Every 15 min | Ping → stuck idempotency reaper (silent when nothing to reap) |
| Every 1 hour | Ping → idempotency cleanup → stale orders → order access exchange cleanup |

Each scheduled run **pings the database first**. If the pooler is temporarily unreachable (`CONNECT_TIMEOUT`, `ENOTFOUND` after sleep or offline), you get one compact `Maintenance: skipped (database unreachable)` line — not a sign of a wrong `DATABASE_URL` if bootstrap and API traffic already succeeded.

See [`info.md` — Maintenance warnings vs wrong DATABASE_URL](info.md#maintenance-warnings-vs-wrong-database_url).
