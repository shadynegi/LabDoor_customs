-- Migration: Soft-delete for customers table
-- Verified: app uses `customers` (no `users` table). Run in Supabase SQL Editor.

ALTER TABLE customers
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_customers_is_deleted ON customers(is_deleted);

-- Optional backfill from existing orders (run once if customers table is empty):
-- INSERT INTO customers (email, name, total_orders, total_spent, last_order_date, first_order_date)
-- SELECT
--   customer_email,
--   MAX(customer_name),
--   COUNT(*)::int,
--   COALESCE(SUM(total), 0),
--   MAX(created_at),
--   MIN(created_at)
-- FROM orders
-- GROUP BY customer_email
-- ON CONFLICT (email) DO NOTHING;

-- ---------- Down migration (manual rollback only) ----------
-- DROP INDEX IF EXISTS idx_customers_is_deleted;
-- ALTER TABLE customers DROP COLUMN IF EXISTS deleted_at;
-- ALTER TABLE customers DROP COLUMN IF EXISTS is_deleted;
