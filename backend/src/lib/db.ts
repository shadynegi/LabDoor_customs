import fs from 'fs';
import path from 'path';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import dotenv from 'dotenv';
import { logger } from './logger';
import { isTransientDbError } from './dbErrors';

export { isTransientDbError } from './dbErrors';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('Missing DATABASE_URL in .env file');
}

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
  /** Included in retry warnings for easier debugging */
  label?: string;
}

function isRetryableError(error: unknown): boolean {
  return isTransientDbError(error);
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
  const { retries = 3, baseMs = 200, label } = options;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      const pgCode = (lastError as Error & { code?: string }).code;

      if (attempt >= retries || !isRetryableError(error)) {
        logger.error(
          {
            label,
            attempt: attempt + 1,
            maxAttempts: retries + 1,
            code: pgCode,
            err: lastError.message,
            pool: getPoolStats(),
          },
          '[withRetry] giving up'
        );
        throw lastError;
      }

      const delay = baseMs * Math.pow(2, attempt) + Math.random() * baseMs;
      logger.warn(
        {
          label,
          attempt: attempt + 1,
          maxAttempts: retries + 1,
          retryInMs: Math.round(delay),
          code: pgCode,
          err: lastError.message,
        },
        '[withRetry] transient failure, retrying'
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
    const code = error instanceof Error ? (error as Error & { code?: string }).code : undefined;
    logger.error(
      { label, durationMs: Date.now() - started, code, err: message, pool: getPoolStats() },
      'Bootstrap: step failed'
    );
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
    return await withRetry(queryFn, { label });
  } finally {
    activeConnections--;
    const duration = Date.now() - startTime;
    const slowQueryMs = parseInt(process.env.DB_SLOW_QUERY_LOG_MS || '2000', 10);
    if (duration >= slowQueryMs) {
      logger.warn(
        { label: label || 'unknown', durationMs: duration, pool: getPoolStats() },
        '[DB] slow query'
      );
    }
  }
}

export default sql;
