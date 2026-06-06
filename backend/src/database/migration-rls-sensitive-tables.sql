-- Enable RLS on sensitive tables (also applied at server boot via ensureRlsPolicies()).
-- Safe to run in Supabase SQL Editor: skips tables that do not exist yet.
-- Runtime tables (payment_idempotency, processed_refund_events, order_checkout_exchanges)
-- are created when the backend starts successfully — re-run this script after first boot if needed.

DO $migrate$
DECLARE
  tbl text;
  pol text;
  tables text[] := ARRAY[
    'coupons',
    'coupon_usage',
    'payment_idempotency',
    'processed_refund_events',
    'order_checkout_exchanges',
    'customers',
    'activity_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = tbl
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
      EXECUTE format('GRANT ALL ON public.%I TO service_role', tbl);

      pol := 'Service role manages ' || tbl;
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol, tbl);
      EXECUTE format(
        'CREATE POLICY %I ON public.%I FOR ALL '
        || 'USING ((select auth.role()) = ''service_role'') '
        || 'WITH CHECK ((select auth.role()) = ''service_role'')',
        pol,
        tbl
      );

      RAISE NOTICE 'RLS enabled on public.%', tbl;
    ELSE
      RAISE NOTICE 'Skipped public.% — table does not exist yet', tbl;
    END IF;
  END LOOP;
END
$migrate$;
