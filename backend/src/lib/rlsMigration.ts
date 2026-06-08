import sql from './db';
import {
  authenticatedHasTableGrants,
  isRlsMigrationApplied,
  logBootstrapStepSkipped,
  serviceRolePolicyExists,
  shouldSkipBootstrapDdl,
  tableHasServiceRolePolicy,
} from './bootstrapSchema';
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

const ALL_RLS_TABLES = new Set<string>([
  ...CLIENT_REVOKED_TABLES,
  ...SERVICE_ROLE_ONLY_TABLES,
]);

/** Quote a SQL identifier (table/policy names from whitelists only). */
function quoteIdent(ident: string): string {
  return `"${ident.replace(/"/g, '""')}"`;
}

function assertAllowedTable(table: string): void {
  if (!ALL_RLS_TABLES.has(table)) {
    throw new Error(`Invalid RLS table name: ${table}`);
  }
}

let publicTablesCache: Set<string> | null = null;

async function loadPublicTables(): Promise<Set<string>> {
  if (!publicTablesCache) {
    const rows = await sql`
      SELECT tablename FROM pg_tables WHERE schemaname = 'public'
    `;
    publicTablesCache = new Set(rows.map((r) => String(r.tablename)));
  }
  return publicTablesCache;
}

async function tableExists(table: string): Promise<boolean> {
  assertAllowedTable(table);
  return (await loadPublicTables()).has(table);
}

async function enableRowLevelSecurity(table: string): Promise<void> {
  if (!(await tableExists(table))) return;
  await sql.unsafe(
    `ALTER TABLE public.${quoteIdent(table)} ENABLE ROW LEVEL SECURITY`
  );
}

async function grantServiceRole(table: string): Promise<void> {
  if (!(await tableExists(table))) return;
  await sql.unsafe(`GRANT ALL ON TABLE public.${quoteIdent(table)} TO service_role`);
}

async function revokeClientRoleGrants(table: string): Promise<void> {
  if (!(await tableExists(table))) return;
  if (!(await authenticatedHasTableGrants(table))) return;
  await sql.unsafe(
    `REVOKE ALL ON TABLE public.${quoteIdent(table)} FROM anon, authenticated`
  );
  await sql.unsafe(`GRANT ALL ON TABLE public.${quoteIdent(table)} TO service_role`);
}

/**
 * Create unified policy only when the table has none.
 * Never DROP on boot — duplicate legacy policies are cleaned via migration SQL.
 */
async function ensureServiceRolePolicy(table: string, policyName: string): Promise<void> {
  assertAllowedTable(table);
  if (!(await tableExists(table))) return;

  if (await serviceRolePolicyExists(table, policyName)) return;

  if (await tableHasServiceRolePolicy(table)) {
    logger.info(`RLS: ${table} already has a service_role policy — skip create`);
    return;
  }

  await sql.unsafe(`
    CREATE POLICY ${quoteIdent(policyName)} ON public.${quoteIdent(table)}
      FOR ALL
      USING ((select auth.role()) = 'service_role')
      WITH CHECK ((select auth.role()) = 'service_role')
  `);
}

/** Destructive legacy cleanup — run only when BOOTSTRAP_FORCE_RLS=true (or via SQL migration). */
async function dropLegacyPolicies(): Promise<void> {
  logger.warn('RLS: BOOTSTRAP_FORCE_RLS — dropping legacy policies (may hold table locks)');
  const drops: Array<readonly [string, string]> = [
    ['products', 'Allow authenticated users to insert products'],
    ['products', 'Allow authenticated users to update products'],
    ['products', 'Allow authenticated users to delete products'],
    ['products', 'Allow public read access to products'],
    ['orders', 'Users can read their own orders'],
    ['orders', 'Allow authenticated users to update orders'],
    ['orders', 'Service role can create orders'],
    ['orders', 'Allow authenticated users to create orders'],
    ['contact_messages', 'Only authenticated users can read contact messages'],
    ['contact_messages', 'Only authenticated users can update contact messages'],
    ['contact_messages', 'Only authenticated users can delete contact messages'],
    ['contact_messages', 'Service role can insert contact messages'],
    ['contact_messages', 'Anyone can submit contact messages'],
    ['customers', 'Authenticated users can manage customers'],
    ['activity_logs', 'Admin can read activity logs'],
    ['activity_logs', 'Service role can insert activity logs'],
    ['activity_logs', 'Service role can update activity logs'],
    ['activity_logs', 'Service role can delete activity logs'],
    ['activity_logs', 'Service role can manage activity logs'],
    ['reviews', 'Anyone can view approved reviews'],
    ['reviews', 'Service role can manage all reviews'],
    ['admin_sessions', 'Service role can manage admin sessions'],
    ['admin_sessions', 'Allow inserting admin sessions'],
    ['admin_sessions', 'Allow reading admin sessions'],
    ['admin_sessions', 'Allow deleting admin sessions'],
    ['review_votes', 'Service role can manage review votes'],
  ];

  for (const [table, policy] of drops) {
    if (!(await tableExists(table))) continue;
    await sql.unsafe(
      `DROP POLICY IF EXISTS ${quoteIdent(policy)} ON public.${quoteIdent(table)}`
    );
  }
}

async function ensureRlsIndexes(): Promise<void> {
  if (await tableExists('coupon_usage')) {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_coupon_usage_order_id ON coupon_usage(order_id)
    `;
  }
  if (await tableExists('reviews')) {
    await sql`
      CREATE INDEX IF NOT EXISTS idx_reviews_order_id ON reviews(order_id)
    `;
  }
}

async function ensureUpdateProductRatingFunction(): Promise<void> {
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
}

async function assertNoClientGrantsRemaining(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';
  const forceAudit = process.env.REQUIRE_RLS_GRANT_AUDIT === 'true';
  if (!isProduction && !forceAudit) return;

  const remaining: string[] = [];
  for (const table of CLIENT_REVOKED_TABLES) {
    if ((await tableExists(table)) && (await authenticatedHasTableGrants(table))) {
      remaining.push(table);
    }
  }

  if (remaining.length) {
    const message = `PostgREST client grants remain on: ${remaining.join(', ')}`;
    logger.error(message);
    if (isProduction && process.env.ALLOW_INSECURE_RLS !== 'true') {
      throw new Error(message);
    }
  }
}

/** Revoke anon/authenticated grants even when full RLS DDL is skipped. */
export async function ensureClientGrantsRevoked(): Promise<void> {
  for (const table of CLIENT_REVOKED_TABLES) {
    await revokeClientRoleGrants(table);
  }
  await assertNoClientGrantsRemaining();
}

/** Idempotent Supabase RLS tighten — backend uses service_role; limits direct PostgREST abuse. */
export async function ensureRlsPolicies(): Promise<void> {
  const isProduction = process.env.NODE_ENV === 'production';

  if (shouldSkipBootstrapDdl() || (await isRlsMigrationApplied())) {
    logBootstrapStepSkipped('rls_policies', 'service_role policies already present');
    await ensureClientGrantsRevoked();
    return;
  }

  try {
    if (process.env.BOOTSTRAP_FORCE_RLS === 'true') {
      await dropLegacyPolicies();
    }

    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      await enableRowLevelSecurity(table);
      await grantServiceRole(table);
    }

    await ensureServiceRolePolicy('products', 'Service role manages products');
    await ensureServiceRolePolicy('orders', 'Service role manages orders');
    await ensureServiceRolePolicy('contact_messages', 'Service role manages contact_messages');

    for (const table of SERVICE_ROLE_ONLY_TABLES) {
      await ensureServiceRolePolicy(table, `Service role manages ${table}`);
    }

    for (const table of ['products', 'orders', 'contact_messages'] as const) {
      await enableRowLevelSecurity(table);
    }

    for (const table of CLIENT_REVOKED_TABLES) {
      await revokeClientRoleGrants(table);
    }

    await assertNoClientGrantsRemaining();

    await ensureRlsIndexes();
    await ensureUpdateProductRatingFunction();

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
