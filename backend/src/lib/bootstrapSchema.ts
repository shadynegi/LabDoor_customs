import sql from './db';
import { logger } from './logger';

export function shouldSkipBootstrapDdl(): boolean {
  return process.env.BOOTSTRAP_SKIP_DDL === 'true';
}

export async function publicTableExists(tableName: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = ${tableName}
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function publicColumnExists(
  tableName: string,
  columnName: string
): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND column_name = ${columnName}
    LIMIT 1
  `;
  return rows.length > 0;
}

export function logBootstrapDdlSkipped(label: string): void {
  logger.info(`Bootstrap: skipping ${label} DDL (already applied or BOOTSTRAP_SKIP_DDL)`);
}

export function logBootstrapStepSkipped(label: string, reason: string): void {
  logger.info(`Bootstrap: skipping ${label} (${reason})`);
}

export async function serviceRolePolicyExists(
  tableName: string,
  policyName: string
): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ${tableName}
      AND policyname = ${policyName}
    LIMIT 1
  `;
  return rows.length > 0;
}

/** Any service_role-style policy (new or legacy naming). */
export async function tableHasServiceRolePolicy(tableName: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = ${tableName}
      AND policyname LIKE 'Service role%'
    LIMIT 1
  `;
  return rows.length > 0;
}

const RLS_MARKER_TABLES = [
  'products',
  'orders',
  'contact_messages',
  'reviews',
  'admin_sessions',
  'activity_logs',
] as const;

/**
 * Skip boot RLS work when tables already have service_role policies.
 * Avoids DROP/CREATE that blocks on existing duplicate policies.
 */
export async function isRlsMigrationApplied(): Promise<boolean> {
  let checked = 0;
  for (const table of RLS_MARKER_TABLES) {
    if (!(await publicTableExists(table))) continue;
    checked++;
    if (!(await tableHasServiceRolePolicy(table))) {
      return false;
    }
  }
  return checked > 0;
}

export async function authenticatedHasTableGrants(tableName: string): Promise<boolean> {
  const rows = await sql`
    SELECT 1
    FROM information_schema.role_table_grants
    WHERE table_schema = 'public'
      AND table_name = ${tableName}
      AND grantee IN ('authenticated', 'anon')
    LIMIT 1
  `;
  return rows.length > 0;
}

export async function hasLegacyAdminSessions(): Promise<boolean> {
  if (!(await publicTableExists('admin_sessions'))) {
    return false;
  }
  const rows = await sql`
    SELECT 1
    FROM admin_sessions
    WHERE token IS NULL
       OR length(token) != 64
       OR token !~ '^[a-f0-9]{64}$'
    LIMIT 1
  `;
  return rows.length > 0;
}
