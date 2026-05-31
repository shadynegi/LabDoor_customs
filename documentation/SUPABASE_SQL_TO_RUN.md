# Supabase SQL Scripts

SQL scripts to initialize and maintain the Lab Door Customs database.

**Full reference:** [`../info.md`](../info.md) | **Setup:** [DATABASE_SETUP.md](./DATABASE_SETUP.md)

## Schema files

Located in `backend/migrations/`:

- Core tables: products, orders, order_items, customers, coupons, reviews, contact_messages
- PayPal fields: capture IDs, refund amounts, access token hashes
- Idempotency and refund event tables (also patched at server boot)

## Running SQL

1. Open Supabase SQL Editor or connect via psql with direct URI (port 5432).
2. Run migration files in order.
3. Verify with `GET /api/health` after backend restart.

See [STEP_BY_STEP_SQL.md](./STEP_BY_STEP_SQL.md) for a guided walkthrough.
