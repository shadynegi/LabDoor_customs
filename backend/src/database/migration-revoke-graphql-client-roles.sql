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
    'order_access_exchanges'
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
