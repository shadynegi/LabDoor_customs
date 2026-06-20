-- Migration: Optimize RLS Policies for Performance
-- Date: December 12, 2025
-- Description: Replace auth function calls with subqueries to prevent re-evaluation per row
-- This significantly improves query performance at scale

-- ============================================================================
-- DROP EXISTING POLICIES
-- ============================================================================

-- Products table policies
DROP POLICY IF EXISTS "Allow authenticated users to insert products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to update products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to delete products" ON products;

-- Orders table policies
DROP POLICY IF EXISTS "Users can read their own orders" ON orders;
DROP POLICY IF EXISTS "Allow authenticated users to update orders" ON orders;

-- Contact messages table policies
DROP POLICY IF EXISTS "Only authenticated users can read contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Only authenticated users can update contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Only authenticated users can delete contact messages" ON contact_messages;

-- ============================================================================
-- CREATE OPTIMIZED POLICIES
-- ============================================================================

-- Products table policies (OPTIMIZED)
-- Using subqueries for auth functions to prevent re-evaluation per row
CREATE POLICY "Allow authenticated users to insert products" ON products
  FOR INSERT WITH CHECK ((select auth.role()) = 'authenticated');

CREATE POLICY "Allow authenticated users to update products" ON products
  FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Allow authenticated users to delete products" ON products
  FOR DELETE USING ((select auth.role()) = 'authenticated');

-- Orders table policies (OPTIMIZED)
-- Using subqueries for auth functions to prevent re-evaluation per row
CREATE POLICY "Users can read their own orders" ON orders
  FOR SELECT USING (
    (select auth.jwt()) ->> 'email' = customer_email OR
    (select auth.role()) = 'authenticated'
  );

CREATE POLICY "Allow authenticated users to update orders" ON orders
  FOR UPDATE USING ((select auth.role()) = 'authenticated');

-- Contact messages table policies (OPTIMIZED)
-- Using subqueries for auth functions to prevent re-evaluation per row
CREATE POLICY "Only authenticated users can read contact messages" ON contact_messages
  FOR SELECT USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Only authenticated users can update contact messages" ON contact_messages
  FOR UPDATE USING ((select auth.role()) = 'authenticated');

CREATE POLICY "Only authenticated users can delete contact messages" ON contact_messages
  FOR DELETE USING ((select auth.role()) = 'authenticated');

-- ============================================================================
-- VERIFICATION
-- ============================================================================

-- You can verify the policies were created correctly by running:
-- SELECT schemaname, tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename IN ('products', 'orders', 'contact_messages')
-- ORDER BY tablename, policyname;

-- ============================================================================
-- PERFORMANCE NOTES
-- ============================================================================

-- BEFORE (inefficient):
--   auth.role() = 'authenticated'
--   ↑ Evaluated for EVERY row in the result set
--
-- AFTER (optimized):
--   (select auth.role()) = 'authenticated'
--   ↑ Evaluated ONCE and reused for all rows
--
-- Performance Impact:
-- - For queries returning 1,000 rows: ~1000x reduction in auth function calls
-- - For queries returning 10,000 rows: ~10,000x reduction in auth function calls
-- - Significantly reduced query execution time at scale

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================

