# Supabase SQL Scripts

SQL scripts to initialize and maintain the Lab Door Customs database.

**Full reference:** [`../info.md`](../info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## Schema files

Located in `backend/src/database/`:

- `schema.sql` — base schema
- `migration-*.sql` — incremental migrations
- `migration-rls-tighten.sql` — RLS policy tighten (also applied at server boot via `ensureRlsPolicies()`)
- `migration-rls-sensitive-tables.sql` — RLS on coupons, coupon_usage, payment_idempotency, processed_refund_events (skips tables not created yet)

Runtime tables created/patched at server boot:

- `payment_idempotency`, `processed_refund_events`, `order_checkout_exchanges`
- `orders.refunded_amount`, customer soft-delete columns, PayPal unique indexes

## Running SQL

1. Open Supabase SQL Editor or connect via psql with direct URI (port 5432).
2. Run migration files in order.
3. Verify with `GET /api/health` after backend restart.

See [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md) for a guided walkthrough.
