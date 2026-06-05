-- Tighten Supabase RLS: service_role only for writes; public read on products only.
-- Run in Supabase SQL Editor after schema.sql.

DROP POLICY IF EXISTS "Allow authenticated users to insert products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to update products" ON products;
DROP POLICY IF EXISTS "Allow authenticated users to delete products" ON products;
DROP POLICY IF EXISTS "Users can read their own orders" ON orders;
DROP POLICY IF EXISTS "Allow authenticated users to update orders" ON orders;
DROP POLICY IF EXISTS "Only authenticated users can read contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Only authenticated users can update contact messages" ON contact_messages;
DROP POLICY IF EXISTS "Only authenticated users can delete contact messages" ON contact_messages;

-- Products: public catalog read only via PostgREST; mutations via backend service_role.
CREATE POLICY "Service role manages products" ON products
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Orders: service role only (backend API).
CREATE POLICY "Service role manages orders" ON orders
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Contact messages: service role only.
CREATE POLICY "Service role manages contact messages" ON contact_messages
  FOR ALL
  USING ((select auth.role()) = 'service_role')
  WITH CHECK ((select auth.role()) = 'service_role');

-- Sensitive tables: enable RLS + service role only (see migration-rls-sensitive-tables.sql).
