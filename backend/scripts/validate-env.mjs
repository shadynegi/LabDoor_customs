#!/usr/bin/env node
/**
 * Validates production environment variables (mirrors server.ts gates).
 * Usage: NODE_ENV=production node scripts/validate-env.mjs
 */
const isProduction = process.env.NODE_ENV === 'production' || process.env.CI_VALIDATE_PRODUCTION === 'true';

const requiredAlways = ['DATABASE_URL'];
const requiredProduction = [
  'FRONTEND_URL',
  'ADMIN_PASSWORD_HASH',
  'ADMIN_USERNAME',
  'JWT_SECRET',
  'REDIS_URL',
  'SENTRY_DSN',
  'WHATSAPP_CONTACT_NUMBER',
  'ORDER_TOKEN_ENCRYPTION_KEY',
  'IP_SALT',
];

function fail(message) {
  console.error(`validate-env: ${message}`);
  process.exit(1);
}

/** Mirrors backend/src/lib/databaseUrl.ts and db.ts pooler detection. */
function isPoolerDatabaseUrl(url) {
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

for (const key of requiredAlways) {
  if (!process.env[key]?.trim()) {
    fail(`Missing required variable: ${key}`);
  }
}

if (isProduction) {
  for (const key of requiredProduction) {
    if (!process.env[key]?.trim()) {
      fail(`Missing production variable: ${key}`);
    }
  }

  if (process.env.TRUST_CLOUDFLARE !== 'true') {
    fail('TRUST_CLOUDFLARE must be "true" in production');
  }

  const jwt = process.env.JWT_SECRET || '';
  if (jwt.length < 32) {
    fail('JWT_SECRET must be at least 32 characters in production');
  }
  const jwtIssues = [];
  if (!/[A-Z]/.test(jwt)) jwtIssues.push('uppercase');
  if (!/[a-z]/.test(jwt)) jwtIssues.push('lowercase');
  if (!/[0-9]/.test(jwt)) jwtIssues.push('number');
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>/?]/.test(jwt)) jwtIssues.push('special character');
  if (jwtIssues.length) {
    fail(`JWT_SECRET must contain: ${jwtIssues.join(', ')}`);
  }

  for (const key of ['ORDER_TOKEN_ENCRYPTION_KEY', 'IP_SALT']) {
    const value = process.env[key]?.trim() || '';
    if (value.length < 32) {
      fail(`${key} must be at least 32 characters in production`);
    }
  }

  if (process.env.ALLOW_INSECURE_RLS === 'true') {
    fail('ALLOW_INSECURE_RLS=true is forbidden in production');
  }

  const dbUrl = process.env.DATABASE_URL?.trim() || '';
  if (!isPoolerDatabaseUrl(dbUrl)) {
    fail(
      'DATABASE_URL must use PgBouncer pooler (host contains "pooler" or port 6543), or set DB_USE_POOLER=true'
    );
  }
}

console.log('validate-env: OK');
