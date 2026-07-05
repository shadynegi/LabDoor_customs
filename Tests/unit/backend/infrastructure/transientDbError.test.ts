import { describe, it, expect } from 'vitest';
import { isTransientDbError } from '../../../../backend/src/lib/dbErrors';

describe('isTransientDbError', () => {
  it('detects CONNECT_TIMEOUT from postgres.js', () => {
    const err = Object.assign(new Error('write CONNECT_TIMEOUT host:6543'), {
      code: 'CONNECT_TIMEOUT',
    });
    expect(isTransientDbError(err)).toBe(true);
  });

  it('detects ENOTFOUND DNS failures', () => {
    const err = Object.assign(new Error('getaddrinfo ENOTFOUND pooler.supabase.com'), {
      code: 'ENOTFOUND',
      errno: -3008,
    });
    expect(isTransientDbError(err)).toBe(true);
  });

  it('does not treat validation errors as transient', () => {
    expect(isTransientDbError(new Error('syntax error at or near'))).toBe(false);
  });
});
