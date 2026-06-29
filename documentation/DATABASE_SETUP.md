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
DATABASE_URL=postgresql://postgres:PASSWORD@db.PROJECT.supabase.co:6543/postgres?pgbouncer=true
```

Production TLS: set `DB_SSL_CA_PATH` to Supabase CA bundle.

---

## Initial setup

1. Create a Supabase project.
2. Run `backend/src/database/schema.sql` in the SQL editor.
3. Optionally run `backend/src/database/seed.sql` for sample products.
4. Apply migration files in `backend/src/database/` as needed.

---

## Core tables

| Table | Purpose |
|-------|---------|
| `products` | Catalog — price, stock, category, size, color, ratings |
| `orders` | Orders — JSONB items/shipping, PayPal IDs, payment/status enums |
| `customers` | Aggregated stats — total_orders, total_spent, soft delete |
| `coupons` | Discount rules — type, limits, scope (`applies_to`) |
| `coupon_usage` | Per-order coupon reservations |
| `contact_messages` | Contact form submissions (no admin API) |
| `activity_logs` | Client activity (anonymized IP) |
| `admin_sessions` | Admin session token hashes (SHA-256) |

---

## Payment tables

Created at server startup via `ensureIdempotencyTable()`, `ensureOrderPaymentSchema()`, and `ensureCheckoutExchangeTable()`:

| Table | Purpose |
|-------|---------|
| `payment_idempotency` | Create/capture deduplication |
| `processed_refund_events` | Refund webhook/admin deduplication |
| `order_checkout_exchanges` | One-time PayPal return codes → access tokens |

Migration files:

- `migration-payment-idempotency.sql` — table + indexes (including partial index for reaper)
- `migration-paypal-unique-refunds.sql`
- `migration-processed-refund-events.sql`

Boot creates missing indexes via `ensureIdempotencyIndexes()` even when `BOOTSTRAP_SKIP_DDL=true`.

---

## Orders table highlights

| Column | Purpose |
|--------|---------|
| `paypal_order_id` | PayPal checkout order ID (unique when set) |
| `paypal_capture_id` | PayPal capture ID (unique when set) |
| `refunded_amount` | Cumulative refunded total |
| `access_token_hash` | SHA-256 hash of customer access token |
| `items` | JSONB line items |
| `shipping_address` | JSONB shipping details |

---

## Reviews

Applied via `migration-reviews.sql`:

- `reviews` — rating, content, moderation status, verified purchase
- `review_votes` — helpful/not helpful votes
- Trigger updates product `rating` and `review_count`

---

## Row-level security

`ensureRlsPolicies()` runs at startup (`backend/src/lib/rlsMigration.ts`; see also `migration-rls-tighten.sql`, `migration-rls-sensitive-tables.sql`, `migration-revoke-graphql-client-roles.sql`).

- **14 tables** have RLS with service_role-only policies (including `order_access_exchanges`).
- **`anon` and `authenticated` grants are revoked** — no public product catalog via PostgREST/GraphQL.
- Boot is **non-destructive** when policies exist. **Production Supabase:** all required migrations applied (June 2026), including performance linter fixes and product search indexes.
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
| Every 1 hour | Ping → idempotency cleanup → stale orders → checkout exchange cleanup → order access exchange cleanup |

Each scheduled run **pings the database first**. If the pooler is temporarily unreachable (`CONNECT_TIMEOUT`, `ENOTFOUND` after sleep or offline), you get one compact `Maintenance: skipped (database unreachable)` line — not a sign of a wrong `DATABASE_URL` if bootstrap and API traffic already succeeded.

Env tuning: `MAINTENANCE_DB_RETRIES` (default 2), `MAINTENANCE_DB_RETRY_MS` (default 1000). Full behavior: [`info.md` — Maintenance jobs](info.md#maintenance-jobs).

## Keep-alive

GitHub Actions cron (every 6 days) runs `backend/scripts/keep-alive.js` to prevent Supabase free-tier pausing. Requires `DATABASE_URL` secret.

See [SUPABASE_SETUP_INSTRUCTIONS.md](./SUPABASE_SETUP_INSTRUCTIONS.md), [GET_DATABASE_URL.md](./GET_DATABASE_URL.md).
