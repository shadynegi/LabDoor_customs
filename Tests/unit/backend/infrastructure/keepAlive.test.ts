import { describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { getConnectionOptions, usePoolerMode, PING_QUERY } = require('../../../../backend/scripts/keep-alive.js');

describe('keep-alive connection config', () => {
  it('uses read-only SELECT 1 ping query', () => {
    expect(PING_QUERY).toBe('SELECT 1 AS ping');
  });
  it('disables prepared statements for transaction pooler port 6543', () => {
    const url =
      'postgresql://postgres.ref:pass@aws-0-ap-south-1.pooler.supabase.com:6543/postgres';
    expect(usePoolerMode(url)).toBe(true);
    expect(getConnectionOptions(url).prepare).toBe(false);
  });

  it('disables prepared statements for session pooler host on port 5432', () => {
    const url =
      'postgresql://postgres.ref:pass@aws-0-ap-south-1.pooler.supabase.com:5432/postgres';
    expect(usePoolerMode(url)).toBe(true);
    expect(getConnectionOptions(url).prepare).toBe(false);
  });

  it('uses prepared statements for direct Supabase host', () => {
    const url = 'postgresql://postgres:pass@db.project.supabase.co:5432/postgres';
    expect(usePoolerMode(url)).toBe(false);
    expect(getConnectionOptions(url).prepare).toBe(true);
  });

  it('always requires SSL', () => {
    const url = 'postgresql://postgres:pass@db.project.supabase.co:5432/postgres';
    expect(getConnectionOptions(url).ssl).toBe('require');
  });
});
