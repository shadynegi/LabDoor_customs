-- Supabase performance linter fixes (safe to re-run).
-- 0001: covering indexes on foreign keys
-- 0006: consolidate duplicate permissive RLS policies

-- ---------------------------------------------------------------------------
-- Unindexed foreign keys (lint 0001)
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON public.coupon_usage(order_id);
CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON public.reviews(order_id);

-- ---------------------------------------------------------------------------
-- activity_logs: one service_role policy (lint 0006)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Service role can update activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Service role can delete activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Service role can manage activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admin can read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Allow public to insert activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Only authenticated users can read activity logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users can read activity logs" ON public.activity_logs;

DROP POLICY IF EXISTS "Service role manages activity_logs" ON public.activity_logs;
CREATE POLICY "Service role manages activity_logs" ON public.activity_logs
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ---------------------------------------------------------------------------
-- reviews: one service_role policy — reads go through Express API (lint 0006)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view approved reviews" ON public.reviews;
DROP POLICY IF EXISTS "Service role can manage all reviews" ON public.reviews;

DROP POLICY IF EXISTS "Service role manages reviews" ON public.reviews;
CREATE POLICY "Service role manages reviews" ON public.reviews
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
