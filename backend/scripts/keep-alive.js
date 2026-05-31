#!/usr/bin/env node
/**
 * Supabase Keep-Alive Script
 *
 * Runs lightweight queries to prevent Supabase free-tier auto-pause (7 days inactivity).
 * Designed for GitHub Actions, cron, or any scheduler every 6 days.
 *
 * Usage:
 *   node scripts/keep-alive.js
 *   npm run keep-alive
 *
 * Env vars required:
 *   DATABASE_URL - Postgres/Supabase connection string (session pooler :5432 recommended)
 *
 * Exit codes:
 *   0 - Success
 *   1 - Failure (DB unreachable, query failed, etc.)
 */

const postgres = require('postgres');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/** Supabase pooler host or transaction port requires prepare=false. */
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

async function runKeepAlive(databaseUrl = process.env.DATABASE_URL) {
  if (!databaseUrl) {
    console.error('❌ DATABASE_URL is not set. Check your .env or GitHub secrets.');
    process.exit(1);
  }

  const startedAt = new Date().toISOString();
  console.log(`🏓 [${startedAt}] Supabase keep-alive ping starting...`);

  const sql = postgres(databaseUrl, getConnectionOptions(databaseUrl));

  try {
    const [versionRow] = await sql`SELECT version() AS version`;
    const [countRow] = await sql`SELECT COUNT(*)::int AS count FROM products`;
    const [nowRow] = await sql`SELECT NOW() AS server_time`;

    console.log('✅ Supabase is alive!');
    console.log(`   📅 Server time:    ${nowRow.server_time.toISOString()}`);
    console.log(`   🗄️  Postgres:       ${versionRow.version.split(',')[0]}`);
    console.log(`   📦 Products count: ${countRow.count}`);
    console.log(`   ⏱️  Completed at:   ${new Date().toISOString()}`);

    await sql.end();
    return 0;
  } catch (err) {
    console.error('❌ Keep-alive failed:');
    console.error(`   Error: ${err.message}`);
    console.error(`   Code:  ${err.code || 'N/A'}`);
    if (err.code === 'ENOTFOUND') {
      console.error('   💡 Hint: Project may already be paused. Restore it manually first.');
    }
    if (err.code === 'ETIMEDOUT' || err.code === 'CONNECT_TIMEOUT') {
      console.error('   💡 Hint: Check network/firewall allows outbound PostgreSQL (5432/6543).');
    }
    try {
      await sql.end({ timeout: 5 });
    } catch {}
    return 1;
  }
}

if (require.main === module) {
  runKeepAlive().then((code) => process.exit(code));
}

module.exports = { usePoolerMode, getConnectionOptions, runKeepAlive };
