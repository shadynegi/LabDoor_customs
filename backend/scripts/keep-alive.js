#!/usr/bin/env node
/**
 * Supabase keep-alive — lightweight read-only ping (SELECT 1).
 *
 * Prevents Supabase free-tier auto-pause after ~7 days of inactivity.
 * Connection options mirror backend/src/lib/db.ts pooler detection (postgres.js + DATABASE_URL).
 *
 * Usage:
 *   node scripts/keep-alive.js
 *   npm run keep-alive
 *
 * Env:
 *   DATABASE_URL            — required (pooler :6543 recommended)
 *   KEEP_ALIVE_TIMEOUT_MS   — optional query timeout (default 30000)
 *   DB_USE_POOLER           — optional, same as app
 *
 * Exit: 0 success, 1 failure
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/** Read-only ping — no writes, minimal load. */
const PING_QUERY = 'SELECT 1 AS ping';

const DEFAULT_TIMEOUT_MS = 30_000;

/** Supabase pooler host or transaction port requires prepare=false (see db.ts). */
function usePoolerMode(url) {
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

function getConnectionOptions(databaseUrl) {
  const poolerMode = usePoolerMode(databaseUrl);
  return {
    max: 1,
    idle_timeout: 5,
    connect_timeout: 30,
    ssl: 'require',
    prepare: !poolerMode,
  };
}

function queryTimeout(ms) {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(`Keep-alive query timed out after ${ms}ms`)), ms);
  });
}

async function runKeepAlive(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl?.trim()) {
    console.error('Keep-alive failed: DATABASE_URL is not set.');
    process.exit(1);
  }

  const timeoutMs = parseInt(process.env.KEEP_ALIVE_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
  const startedAt = new Date().toISOString();
  console.log(`Keep-alive started (${startedAt})`);

  const sql = postgres(databaseUrl, getConnectionOptions(databaseUrl));

  try {
    const [row] = await Promise.race([
      sql`SELECT 1 AS ping`,
      queryTimeout(timeoutMs),
    ]);

    console.log('Database connection successful');
    console.log(`Query executed successfully (${PING_QUERY})`);
    console.log(`Execution completed (ping=${row?.ping ?? 1})`);

    await sql.end({ timeout: 5 });
    return 0;
  } catch (err) {
    console.error('Keep-alive failed:');
    console.error(`  Message: ${err.message}`);
    console.error(`  Code:    ${err.code || 'N/A'}`);
    if (err.code === 'ENOTFOUND') {
      console.error('  Hint: Project may be paused — restore it in the Supabase dashboard.');
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'CONNECT_TIMEOUT') {
      console.error('  Hint: Check outbound PostgreSQL (5432/6543) and DATABASE_URL.');
    }
    try {
      await sql.end({ timeout: 5 });
    } catch {
      /* ignore close errors */
    }
    return 1;
  }
}

if (require.main === module) {
  runKeepAlive().then((code) => process.exit(code));
}

module.exports = {
  usePoolerMode,
  getConnectionOptions,
  runKeepAlive,
  PING_QUERY,
  DEFAULT_TIMEOUT_MS,
};
