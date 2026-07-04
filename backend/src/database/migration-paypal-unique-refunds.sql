-- DEPRECATED (July 2026): PayPal removed — use migration-drop-paypal.sql on existing DBs.
-- PayPal ID uniqueness + cumulative refund tracking
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS refunded_amount DECIMAL(10, 2) NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paypal_order_id_unique
  ON orders (paypal_order_id)
  WHERE paypal_order_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_paypal_capture_id_unique
  ON orders (paypal_capture_id)
  WHERE paypal_capture_id IS NOT NULL;
