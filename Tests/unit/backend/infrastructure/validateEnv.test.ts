import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const validateEnvScript = path.resolve(scriptDir, '../../../../backend/scripts/validate-env.mjs');

const POOLER_DATABASE_URL =
  'postgresql://postgres.ref:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres?pgbouncer=true';

const VALID_PRODUCTION_ENV: Record<string, string> = {
  NODE_ENV: 'production',
  CI_VALIDATE_PRODUCTION: 'true',
  DATABASE_URL: POOLER_DATABASE_URL,
  FRONTEND_URL: 'https://www.labdoorcustoms.com',
  ADMIN_PASSWORD_HASH: '$2b$12$ci.placeholder.hash.for.validation.onlyxx',
  ADMIN_USERNAME: 'admin',
  JWT_SECRET: 'ProductionJwtSecretWithComplexity1!@#Aa',
  REDIS_URL: 'redis://default:pass@redis.railway.internal:6379',
  SENTRY_DSN: 'https://example@sentry.io/123',
  WHATSAPP_CONTACT_NUMBER: '+919888514572',
  ORDER_TOKEN_ENCRYPTION_KEY: 'a'.repeat(32),
  IP_SALT: 'b'.repeat(32),
  TRUST_CLOUDFLARE: 'true',
};

function runValidateEnv(overrides: Record<string, string | undefined> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env };

  for (const key of Object.keys(overrides)) {
    const value = overrides[key];
    if (value === undefined) {
      delete env[key];
    } else {
      env[key] = value;
    }
  }

  return spawnSync(process.execPath, [validateEnvScript], {
    env,
    encoding: 'utf8',
  });
}

describe('backend/scripts/validate-env.mjs (production stability)', () => {
  it('passes with a complete production configuration', () => {
    const result = runValidateEnv(VALID_PRODUCTION_ENV);
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('validate-env: OK');
  });

  it('passes in non-production when only DATABASE_URL is set', () => {
    const result = runValidateEnv({
      NODE_ENV: 'test',
      CI_VALIDATE_PRODUCTION: undefined,
      DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/postgres',
      FRONTEND_URL: undefined,
      REDIS_URL: undefined,
      SENTRY_DSN: undefined,
      JWT_SECRET: undefined,
      ADMIN_USERNAME: undefined,
      ADMIN_PASSWORD_HASH: undefined,
      WHATSAPP_CONTACT_NUMBER: undefined,
      ORDER_TOKEN_ENCRYPTION_KEY: undefined,
      IP_SALT: undefined,
      TRUST_CLOUDFLARE: undefined,
    });

    expect(result.status).toBe(0);
    expect(result.stdout).toContain('validate-env: OK');
  });

  it('exits with a clear error when DATABASE_URL is missing', () => {
    const result = runValidateEnv({
      NODE_ENV: 'test',
      CI_VALIDATE_PRODUCTION: undefined,
      DATABASE_URL: undefined,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Missing required variable: DATABASE_URL/);
  });

  it('exits when production REDIS_URL is missing', () => {
    const result = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      REDIS_URL: undefined,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Missing production variable: REDIS_URL/);
  });

  it('exits when production SENTRY_DSN is missing', () => {
    const result = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      SENTRY_DSN: undefined,
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/Missing production variable: SENTRY_DSN/);
  });

  it('exits when production auth/session secrets are missing', () => {
    for (const key of ['JWT_SECRET', 'ORDER_TOKEN_ENCRYPTION_KEY', 'IP_SALT', 'ADMIN_PASSWORD_HASH']) {
      const result = runValidateEnv({
        ...VALID_PRODUCTION_ENV,
        [key]: undefined,
      });

      expect(result.status).toBe(1);
      expect(result.stderr).toMatch(new RegExp(`Missing production variable: ${key}`));
    }
  });

  it('exits when JWT_SECRET is too short or lacks complexity in production', () => {
    const short = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      JWT_SECRET: 'short',
    });
    expect(short.status).toBe(1);
    expect(short.stderr).toMatch(/JWT_SECRET must be at least 32 characters/);

    const weak = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      JWT_SECRET: 'a'.repeat(40),
    });
    expect(weak.status).toBe(1);
    expect(weak.stderr).toMatch(/JWT_SECRET must contain:/);
  });

  it('exits when TRUST_CLOUDFLARE is not true in production', () => {
    const result = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      TRUST_CLOUDFLARE: 'false',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/TRUST_CLOUDFLARE must be "true" in production/);
  });

  it('requires WHATSAPP_CONTACT_NUMBER but not optional WhatsApp Cloud API credentials', () => {
    const missingContact = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      WHATSAPP_CONTACT_NUMBER: undefined,
    });
    expect(missingContact.status).toBe(1);
    expect(missingContact.stderr).toMatch(/Missing production variable: WHATSAPP_CONTACT_NUMBER/);

    const withoutCloudApi = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      WHATSAPP_CLOUD_ACCESS_TOKEN: undefined,
      WHATSAPP_CLOUD_PHONE_NUMBER_ID: undefined,
    });
    expect(withoutCloudApi.status).toBe(0);
    expect(withoutCloudApi.stdout).toContain('validate-env: OK');
  });

  it('requires DATABASE_URL to target the PgBouncer pooler in production', () => {
    const directHost = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      DATABASE_URL: 'postgresql://postgres:pass@db.project.supabase.co:5432/postgres',
      DB_USE_POOLER: undefined,
    });
    expect(directHost.status).toBe(1);
    expect(directHost.stderr).toMatch(/DATABASE_URL must use PgBouncer pooler/);

    const poolerPort = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      DATABASE_URL: POOLER_DATABASE_URL,
    });
    expect(poolerPort.status).toBe(0);

    const forcedPooler = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      DATABASE_URL: 'postgresql://postgres:pass@db.project.supabase.co:5432/postgres',
      DB_USE_POOLER: 'true',
    });
    expect(forcedPooler.status).toBe(0);
  });

  it('forbids ALLOW_INSECURE_RLS=true in production', () => {
    const result = runValidateEnv({
      ...VALID_PRODUCTION_ENV,
      ALLOW_INSECURE_RLS: 'true',
    });

    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(/ALLOW_INSECURE_RLS=true is forbidden in production/);
  });
});

describe('isPoolerDatabaseUrl', () => {
  it('detects pooler host and transaction port', async () => {
    const { isPoolerDatabaseUrl } = await import('../../../../backend/src/lib/databaseUrl');

    expect(
      isPoolerDatabaseUrl(
        'postgresql://postgres.ref:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres'
      )
    ).toBe(true);
    expect(
      isPoolerDatabaseUrl(
        'postgresql://postgres.ref:pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'
      )
    ).toBe(true);
    expect(isPoolerDatabaseUrl('postgresql://postgres:pass@db.project.supabase.co:5432/postgres')).toBe(
      false
    );
  });
});
