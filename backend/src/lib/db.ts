import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import dotenv from 'dotenv';
import { logger } from './logger';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL in .env file');
}

/** Postgres connection errors worth retrying (transient pool/network). */
const RETRYABLE_PG_CODES = new Set([
  'ECONNRESET',
  'CONNECTION_ENDED',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
  '57014', // query_canceled (statement timeout)
]);

const isProduction = process.env.NODE_ENV === 'production';

/** Supabase pooler (PgBouncer) requires prepared statements disabled. */
function usePoolerMode(url: string): boolean {
  if (process.env.DB_USE_POOLER === 'true') return true;
  try {
    const parsed = new URL(url.replace(/^postgres(ql)?:\/\//, 'http://'));
    const host = parsed.hostname.toLowerCase();
    const port = parsed.port || '5432';
    return host.includes('pooler') || port === '6543';
  } catch {
    return url.includes('pooler') || url.includes(':6543');
  }
}

const poolerMode = usePoolerMode(connectionString);
const defaultPoolMax = poolerMode ? 5 : 10;
const maxConnections = parseInt(process.env.DB_POOL_MAX || String(defaultPoolMax), 10);

if (poolerMode) {
  logger.info(
    `[DB] PgBouncer pooler mode enabled (prepare=false, max=${maxConnections}). ` +
      'Use Supabase pooler URL port 6543 or set DB_USE_POOLER=true.'
  );
}

function buildSslConfig(): false | { rejectUnauthorized: boolean; ca?: string } {
  if (!isProduction) return false;

  const rejectUnauthorized = process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false';
  const caPath = process.env.DB_SSL_CA_PATH;

  if (caPath) {
    try {
      const resolved = path.resolve(caPath);
      return {
        rejectUnauthorized: true,
        ca: fs.readFileSync(resolved, 'utf8'),
      };
    } catch (error) {
      logger.error(`Failed to read DB_SSL_CA_PATH (${caPath}):`, error);
      process.exit(1);
    }
  }

  return { rejectUnauthorized };
}

const statementTimeoutMs = parseInt(process.env.DB_STATEMENT_TIMEOUT_MS || '300000', 10);

const sql: Sql = postgres(connectionString, {
  max: maxConnections,
  idle_timeout: 30,
  connect_timeout: 10,
  max_lifetime: 1800,
  fetch_types: true,
  transform: {
    undefined: null,
  },
  onnotice: () => {},
  debug:
    process.env.DB_DEBUG === 'true'
      ? (_connection, query) => {
          logger.info(`[DB Query] ${query.slice(0, 100)}...`);
        }
      : undefined,
  ssl: buildSslConfig(),
  prepare: !poolerMode,
  connection: {
    statement_timeout: statementTimeoutMs,
  },
});

export interface WithRetryOptions {
  retries?: number;
  baseMs?: number;
}

function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const err = error as Error & { code?: string };
  if (err.code && RETRYABLE_PG_CODES.has(err.code)) return true;

  const msg = err.message;
  return (
    msg.includes('ECONNRESET') ||
    msg.includes('57P01') ||
    msg.includes('57P03') ||
    msg.includes('08006') ||
    msg.includes('08001') ||
    msg.includes('ETIMEDOUT') ||
    msg.includes('502') ||
    msg.includes('503') ||
    msg.includes('504') ||
    msg.includes('Connection terminated') ||
    msg.includes('CONNECTION_ENDED') ||
    msg.includes('statement timeout') ||
    msg.includes('timed out')
  );
}

/** Verify pool connectivity after long idle periods (e.g. post-bootstrap). */
export async function pingDatabase(): Promise<void> {
  await withRetry(() => sql`SELECT 1`, { retries: 3, baseMs: 500 });
}

/** Fail fast when the pooler link is down (bootstrap should not hang silently). */
export async function pingDatabaseWithTimeout(
  timeoutMs = parseInt(process.env.BOOTSTRAP_PING_TIMEOUT_MS || '20000', 10)
): Promise<void> {
  await Promise.race([
    pingDatabase(),
    new Promise<never>((_, reject) => {
      setTimeout(
        () =>
          reject(
            new Error(
              `Database ping timed out after ${timeoutMs}ms — check DATABASE_URL and Supabase pooler (port 6543)`
            )
          ),
        timeoutMs
      );
    }),
  ]);
}

/**
 * Exponential backoff + jitter for transient failures.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: WithRetryOptions = {}
): Promise<T> {
  const { retries = 3, baseMs = 200 } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt >= retries || !isRetryableError(error)) {
        throw lastError;
      }

      const delay = baseMs * Math.pow(2, attempt) + Math.random() * baseMs;
      logger.warn(
        `[withRetry] attempt ${attempt + 1}/${retries} failed, retrying in ${Math.round(delay)}ms:`,
        lastError.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Operation failed after retries');
}

/** Run boot-time schema/RLS tasks with extra retries (slow Supabase pooler). */
export async function runBootstrapTask<T>(
  label: string,
  fn: () => Promise<T>
): Promise<T> {
  const started = Date.now();
  logger.info(`Bootstrap: starting ${label}`);
  const heartbeat = setInterval(() => {
    logger.info(`Bootstrap: still running ${label} (${Date.now() - started}ms elapsed)`);
  }, 15_000);
  try {
    const result = await withRetry(fn, { retries: 2, baseMs: 2000 });
    logger.info(`Bootstrap: finished ${label} (${Date.now() - started}ms)`);
    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error(`Bootstrap: failed ${label} after ${Date.now() - started}ms`);
    throw new Error(`Bootstrap step failed (${label}): ${message}`);
  } finally {
    clearInterval(heartbeat);
  }
}

/** Run async tasks in fixed-size parallel chunks (e.g. bulk inserts). */
export async function runInChunks<T, R>(
  items: T[],
  chunkSize: number,
  fn: (chunk: T[]) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    results.push(await fn(chunk));
  }
  return results;
}

let activeConnections = 0;
let totalQueries = 0;

export function getPoolStats() {
  return {
    activeConnections,
    totalQueries,
    maxConnections,
    isProduction,
    poolerMode,
    prepareEnabled: !poolerMode,
  };
}

export async function query<T>(queryFn: () => Promise<T>, label?: string): Promise<T> {
  const startTime = Date.now();
  activeConnections++;
  totalQueries++;

  try {
    return await withRetry(queryFn);
  } finally {
    activeConnections--;
    const duration = Date.now() - startTime;
    if (isProduction && duration > 1000) {
      logger.warn(`[Slow Query] ${label || 'Unknown'}: ${duration}ms`);
    }
  }
}

export default sql;
