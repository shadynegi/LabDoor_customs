-- Remove legacy PayPal checkout artifacts (July 2026 — WhatsApp checkout only).
-- Run once in Supabase SQL Editor after deploying code that drops PayPal columns/tables.

-- Orders: legacy PayPal ID columns
DROP INDEX IF EXISTS public.idx_orders_paypal_order_id;
DROP INDEX IF EXISTS public.idx_orders_paypal_order_id_unique;
DROP INDEX IF EXISTS public.idx_orders_paypal_capture_id_unique;

ALTER TABLE public.orders DROP COLUMN IF EXISTS paypal_order_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS paypal_capture_id;
ALTER TABLE public.orders DROP COLUMN IF EXISTS refunded_amount;

-- Payment idempotency: legacy PayPal order reference
ALTER TABLE public.payment_idempotency DROP COLUMN IF EXISTS paypal_order_id;

-- Legacy PayPal refund deduplication + checkout return exchange tables
DROP TABLE IF EXISTS public.processed_refund_events;
DROP TABLE IF EXISTS public.order_checkout_exchanges;

-- Verify (expect 0 rows)
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'orders'
  AND column_name IN ('paypal_order_id', 'paypal_capture_id', 'refunded_amount');

SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('processed_refund_events', 'order_checkout_exchanges');
