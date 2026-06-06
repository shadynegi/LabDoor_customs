import sql from './db';
import { logger } from './logger';

/** Tables that must not be readable via anon/authenticated (PostgREST / GraphQL). */
const CLIENT_REVOKED_TABLES = [
  'products',
  'orders',
  'contact_messages',
  'reviews',
  'review_votes',
  'coupons',
  'coupon_usage',
  'payment_idempotency',
  'processed_refund_events',
  'order_checkout_exchanges',
  'order_access_exchanges',
  'customers',
  'activity_logs',
  'admin_sessions',
] as const;

/** Tables that must have RLS on — backend uses service_role / postgres (bypasses RLS). */
const SERVICE_ROLE_ONLY_TABLES = [
  'coupons',
  'coupon_usage',
  'payment_idempotency',
  'processed_refund_events',
  'order_checkout_exchanges',
  'order_access_exchanges',
  'customers',
  'activity_logs',
  'admin_sessions',
  'reviews',
  'review_votes',
] as const;

async function enableRowLevelSecurity(table: string): Promise<void> {
  await sql`
    DO $rls$
    DECLARE
      tbl text := ${table};
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
      ) THEN
        EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
      END IF;
    END
    $rls$
  `;
}

async function grantServiceRole(table: string): Promise<void> {
  await sql`
    DO $grant$
    DECLARE
      tbl text := ${table};
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
      ) THEN
        EXECUTE format('GRANT ALL ON %I TO service_role', tbl);
      END IF;
    END
    $grant$
  `;
}

async function revokeClientRoleGrants(table: string): Promise<void> {
  await sql`
    DO $revoke$
    DECLARE
      tbl text := ${table};
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
      ) THEN
        EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon, authenticated', tbl);
        EXECUTE format('GRANT ALL ON TABLE public.%I TO service_role', tbl);
      END IF;
    END
    $revoke$
  `;
}

async function ensureServiceRolePolicy(table: string, policyName: string): Promise<void> {
  await sql`
    DO $policy$
    DECLARE
      tbl text := ${table};
      pol text := ${policyName};
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl
      ) AND NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public' AND tablename = tbl AND policyname = pol
      ) THEN
        EXECUTE format(
          'CREATE POLICY %I ON %I FOR ALL USING ((select auth.role()) = ''service_role'') WITH CHECK ((select auth.role()) = ''service_role'')',
          pol,
          tbl
        );
      END IF;
    END
    $policy$
  `;
}

/** Idempotent Supabase RLS tighten — backend uses service_role; limits direct PostgREST abuse. */
export async function ensureRlsPolicies(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  try {
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to insert products" ON products`;
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to update products" ON products`;
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to delete products" ON products`;
    await sql`DROP POLICY IF EXISTS "Users can read their own orders" ON orders`;
    await sql`DROP POLICY IF EXISTS "Allow authenticated users to update orders" ON orders`;
    await sql`DROP POLICY IF EXISTS "Only authenticated users can read contact messages" ON contact_messages`;
    await sql`DROP POLICY IF EXISTS "Only authenticated users can update contact messages" ON contact_messages`;
    await sql`DROP POLICY IF EXISTS "Only authenticated users can delete contact messages" ON contact_messages`;
    await sql`DROP POLICY IF EXISTS "Authenticated users can manage customers" ON customers`;
    await sql`DROP POLICY IF EXISTS "Admin can read activity logs" ON activity_logs`;
    await sql`DROP POLICY IF EXISTS "Service role can insert activity logs" ON activity_logs`;
    await sql`DROP POLICY IF EXISTS "Service role can update activity logs" ON activity_logs`;
    await sql`DROP POLICY IF EXISTS "Service role can delete activity logs" ON activity_logs`;
    await sql`DROP POLICY IF EXISTS "Service role can manage activity logs" ON activity_logs`;
    await sql`DROP POLICY IF EXISTS "Anyone can view approved reviews" ON reviews`;
    await sql`DROP POLICY IF EXISTS "Service role can manage all reviews" ON reviews`;

    await sql`DROP POLICY IF EXISTS "Allow public read access to products" ON products`;

    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      await enableRowLevelSecurity(table);
      await grantServiceRole(table);
    }

    await ensureServiceRolePolicy('products', 'Service role manages products');
    await ensureServiceRolePolicy('orders', 'Service role manages orders');
    await ensureServiceRolePolicy('contact_messages', 'Service role manages contact_messages');

    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      const policyName = `Service role manages ${table}`;
      await ensureServiceRolePolicy(table, policyName);
    }

    await sql`ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE IF EXISTS orders ENABLE ROW LEVEL SECURITY`;
    await sql`ALTER TABLE IF EXISTS contact_messages ENABLE ROW LEVEL SECURITY`;

    for (const table of CLIENT_REVOKED_TABLES) {
      await revokeClientRoleGrants(table);
    }

    await sql`
      CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage(order_id)
    `;
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id)
    `;

    await sql`
      DROP POLICY IF EXISTS "Service role manages reviews" ON reviews
    `;
    await sql`
      CREATE POLICY "Service role manages reviews" ON reviews
        FOR ALL
        USING ((select auth.role()) = 'service_role')
        WITH CHECK ((select auth.role()) = 'service_role')
    `;

    await sql`
      CREATE OR REPLACE FUNCTION public.update_product_rating()
      RETURNS TRIGGER
      LANGUAGE plpgsql
      SET search_path = public
      AS $fn$
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
      $fn$
    `;

    logger.info('RLS policy migration applied');
  } catch (error) {
    logger.error('RLS policy migration failed:', error);
    const dbUrl = process.env.DATABASE_URL || '';
    const isSupabase =
      Boolean(process.env.SUPABASE_URL?.trim()) || dbUrl.includes('supabase.co');
    const allowInsecure = process.env.ALLOW_INSECURE_RLS === 'true';

    if ((isProduction || isSupabase) && !allowInsecure) {
      throw error;
    }
    logger.warn('RLS policy migration skipped (set ALLOW_INSECURE_RLS=true to suppress on local DB)');
  }
}
