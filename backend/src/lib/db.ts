import postgres from 'postgres';
import type { Sql } from 'postgres';
import dotenv from 'dotenv';

dotenv.config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('❌ Missing DATABASE_URL in .env file');
}

/** Postgres connection errors worth retrying (transient pool/network). */
const RETRYABLE_PG_CODES = new Set([
  'ECONNRESET',
  '57P01', // admin_shutdown
  '57P03', // cannot_connect_now
  '08006', // connection_failure
  '08001', // sqlclient_unable_to_establish_sqlconnection
]);

const isProduction = process.env.NODE_ENV === 'production';
const maxConnections = parseInt(process.env.DB_POOL_MAX || '10', 10);

/** Supabase pooler (PgBouncer) requires prepared statements disabled. */
function usePoolerMode(url: string): boolean {
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
          console.log(`[DB Query] ${query.slice(0, 100)}...`);
        }
      : undefined,
  ssl: isProduction ? { rejectUnauthorized: false } : false,
  prepare: !poolerMode,
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
    msg.includes('timed out')
  );
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
      console.warn(
        `[withRetry] attempt ${attempt + 1}/${retries} failed, retrying in ${Math.round(delay)}ms:`,
        lastError.message
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error('Operation failed after retries');
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
      console.warn(`[Slow Query] ${label || 'Unknown'}: ${duration}ms`);
    }
  }
}

process.on('SIGTERM', async () => {
  console.log('Closing database connections...');
  await sql.end();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Closing database connections...');
  await sql.end();
  process.exit(0);
});

export default sql;
