import sql from './db';
import { logger } from './logger';

/** Tables that must have RLS on — backend uses service_role / postgres (bypasses RLS). */
const SERVICE_ROLE_ONLY_TABLES = [
  'coupons',
  'coupon_usage',
  'payment_idempotency',
  'processed_refund_events',
  'order_checkout_exchanges',
  'customers',
  'activity_logs',
  'admin_sessions',
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

    await sql`
      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_policies
          WHERE tablename = 'products' AND policyname = 'Allow public read access to products'
        ) THEN
          CREATE POLICY "Allow public read access to products" ON products
            FOR SELECT USING (true);
        END IF;
      END $$
    `;

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

    logger.info('RLS policy migration applied');
  } catch (error) {
    logger.error('RLS policy migration failed:', error);
    if (isProduction) {
      throw error;
    }
    logger.warn('RLS policy migration skipped (non-Supabase DB?)');
  }
}
