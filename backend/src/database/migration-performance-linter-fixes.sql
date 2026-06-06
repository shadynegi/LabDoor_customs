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

-- ---------------------------------------------------------------------------
-- admin_sessions (lint 0006)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage admin sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Allow inserting admin sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Allow reading admin sessions" ON public.admin_sessions;
DROP POLICY IF EXISTS "Allow deleting admin sessions" ON public.admin_sessions;

DROP POLICY IF EXISTS "Service role manages admin_sessions" ON public.admin_sessions;
CREATE POLICY "Service role manages admin_sessions" ON public.admin_sessions
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ---------------------------------------------------------------------------
-- contact_messages (lint 0006)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can insert contact messages" ON public.contact_messages;
DROP POLICY IF EXISTS "Anyone can submit contact messages" ON public.contact_messages;

DROP POLICY IF EXISTS "Service role manages contact_messages" ON public.contact_messages;
CREATE POLICY "Service role manages contact_messages" ON public.contact_messages
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ---------------------------------------------------------------------------
-- orders (lint 0006)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can create orders" ON public.orders;
DROP POLICY IF EXISTS "Allow authenticated users to create orders" ON public.orders;

DROP POLICY IF EXISTS "Service role manages orders" ON public.orders;
CREATE POLICY "Service role manages orders" ON public.orders
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- ---------------------------------------------------------------------------
-- review_votes (lint 0006)
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "Service role can manage review votes" ON public.review_votes;

DROP POLICY IF EXISTS "Service role manages review_votes" ON public.review_votes;
CREATE POLICY "Service role manages review_votes" ON public.review_votes
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');
