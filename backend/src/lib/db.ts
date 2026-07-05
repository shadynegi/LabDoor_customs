import fs from 'fs';
import path from 'path';
import { AsyncLocalStorage } from 'node:async_hooks';
import postgres from 'postgres';
import type { Sql, TransactionSql, PendingQuery } from 'postgres';
import dotenv from 'dotenv';
import { logger } from './logger';
import { isTransientDbError } from './dbErrors';
import { runWithConcurrency as runTasksWithConcurrency } from './runWithConcurrency';

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
const defaultPoolMax = poolerMode ? 10 : 20;
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

const baseSql: Sql = postgres(connectionString, {
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

/** Inside sql.begin — one pool slot for the whole transaction; tx queries share it. */
const txnQueryDepth = new AsyncLocalStorage<number>();

let inFlightQueries = 0;
const queryWaitQueue: Array<() => void> = [];

async function acquireQuerySlot(): Promise<void> {
  if ((txnQueryDepth.getStore() ?? 0) > 0) {
    return;
  }
  if (inFlightQueries < maxConnections) {
    inFlightQueries++;
    return;
  }
  await new Promise<void>((resolve) => {
    queryWaitQueue.push(() => {
      inFlightQueries++;
      resolve();
    });
  });
}

function releaseQuerySlot(): void {
  if ((txnQueryDepth.getStore() ?? 0) > 0) {
    return;
  }
  inFlightQueries = Math.max(0, inFlightQueries - 1);
  const next = queryWaitQueue.shift();
  if (next) next();
}

async function withQuerySlot<T>(fn: () => Promise<T>): Promise<T> {
  if ((txnQueryDepth.getStore() ?? 0) > 0) {
    return fn();
  }
  await acquireQuerySlot();
  try {
    return await fn();
  } finally {
    releaseQuerySlot();
  }
}

function isPostgresQuery(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    (value as { tagged?: boolean }).tagged === true
  );
}

/** Defer execution until await so nested sql fragments compose and .cursor() stays available. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function wrapSqlQuery<T extends PendingQuery<any>>(query: T): T {
  return new Proxy(query, {
    get(target, prop, receiver) {
      if (prop === 'then') {
        return (
          onFulfilled?: (value: unknown) => unknown,
          onRejected?: (reason: unknown) => unknown
        ) => withQuerySlot(() => (target as Promise<unknown>).then(onFulfilled, onRejected));
      }
      if (prop === 'catch') {
        return (onRejected: (reason: unknown) => unknown) =>
          withQuerySlot(() => (target as Promise<unknown>).catch(onRejected));
      }
      if (prop === 'finally') {
        return (onFinally: () => void | Promise<void>) =>
          withQuerySlot(() => (target as Promise<unknown>).finally(onFinally));
      }

      const value = Reflect.get(target, prop, receiver);

      if (typeof value === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (...args: any[]) => {
          const result = value.apply(target, args);
          if (result === target) return receiver;
          if (isPostgresQuery(result)) return wrapSqlQuery(result);
          return result;
        };
      }

      return value;
    },
  }) as T;
}

const taggedSql = (strings: TemplateStringsArray, ...values: any[]) =>
  wrapSqlQuery(baseSql(strings, ...values));

const sql = Object.assign(taggedSql, baseSql) as Sql;

const baseBegin = baseSql.begin.bind(baseSql);
sql.begin = ((callback: (tx: TransactionSql) => unknown | Promise<unknown>) =>
  withQuerySlot(() =>
    baseBegin(async (tx) => txnQueryDepth.run(1, () => callback(tx)))
  )) as typeof baseSql.begin;

const baseUnsafe = baseSql.unsafe.bind(baseSql);
sql.unsafe = ((...args: Parameters<typeof baseSql.unsafe>) =>
  wrapSqlQuery(baseUnsafe(...args))) as typeof baseSql.unsafe;

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

/** Leave headroom for auth, login, and incidental reads when fanning out analytics queries. */
export function getRecommendedQueryConcurrency(reserve = 4): number {
  const reserveSlots = Math.max(0, reserve);
  return Math.max(1, maxConnections - reserveSlots);
}

/**
 * Run independent async tasks with a concurrency cap so we do not exhaust the postgres.js pool
 * (e.g. admin analytics with many parallel COUNT queries on DB_POOL_MAX=10).
 */
export async function runWithConcurrency<T>(
  tasks: Array<() => Promise<T>>,
  limit = getRecommendedQueryConcurrency()
): Promise<T[]> {
  return runTasksWithConcurrency(tasks, limit);
}

let totalQueries = 0;

export function getPoolStats() {
  return {
    activeConnections: inFlightQueries,
    totalQueries,
    maxConnections,
    queuedQueries: queryWaitQueue.length,
    isProduction,
    poolerMode,
    prepareEnabled: !poolerMode,
  };
}

export async function query<T>(queryFn: () => Promise<T>, label?: string): Promise<T> {
  const startTime = Date.now();
  totalQueries++;

  try {
    return await withRetry(queryFn, { label });
  } finally {
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
