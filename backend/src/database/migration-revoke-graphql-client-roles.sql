-- Revoke anon/authenticated table access (fixes Supabase linter 0026/0027 GraphQL exposure).
-- Lab Door Customs uses Express + service_role only — clients must not query PostgREST/GraphQL directly.
-- Safe to re-run: skips tables that do not exist.

DO $migrate$
DECLARE
  tbl text;
  tables text[] := ARRAY[
    'products',
    'orders',
    'contact_messages',
    'activity_logs',
    'admin_sessions',
    'customers',
    'coupons',
    'coupon_usage',
    'payment_idempotency',
    'processed_refund_events',
    'order_checkout_exchanges',
    'order_access_exchanges',
    'reviews',
    'review_votes'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
      EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
      RAISE NOTICE 'Revoked anon/authenticated on public.%', tbl;
    ELSE
      RAISE NOTICE 'Skipped public.% — table does not exist yet', tbl;
    END IF;
  END LOOP;
END
$migrate$;

-- Lint 0011: function search_path must be fixed (mutable search_path)
CREATE OR REPLACE FUNCTION public.update_product_rating()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  avg_rating DECIMAL(3,2);
  total_reviews INTEGER;
BEGIN
  SELECT
    COALESCE(AVG(rating)::DECIMAL(3,2), 0),
    COUNT(*)
  INTO avg_rating, total_reviews
  FROM public.reviews
  WHERE product_id = COALESCE(NEW.product_id, OLD.product_id)
    AND status = 'approved';

  UPDATE public.products
  SET
    rating = avg_rating,
    review_count = total_reviews,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.product_id, OLD.product_id);

  RETURN COALESCE(NEW, OLD);
END;
$$;
