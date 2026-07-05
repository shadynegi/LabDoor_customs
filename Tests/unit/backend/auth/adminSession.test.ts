import { describe, expect, it } from 'vitest';
import { hashAdminSessionToken } from '../../../../backend/src/lib/adminSession';

describe('adminSession', () => {
  it('hashes session tokens as 64-char hex', () => {
    const hash = hashAdminSessionToken('payload.signature');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]+$/);
  });

  it('does not store raw token in hash output', () => {
    const token = 'eyJ.test.token.signature';
    expect(hashAdminSessionToken(token)).not.toBe(token);
  });
});
