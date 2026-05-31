import { describe, it, expect } from 'vitest';
import {
  generateOrderAccessToken,
  hashOrderAccessToken,
  orderAccessMatches,
  stripOrderSecrets,
} from '../../backend/src/lib/orderTokens';

describe('orderTokens', () => {
  it('generates token and matching hash', () => {
    const { token, hash } = generateOrderAccessToken();
    expect(token).toHaveLength(64);
    expect(hash).toHaveLength(64);
    expect(orderAccessMatches(hash, token)).toBe(true);
  });

  it('rejects wrong token for stored hash', () => {
    const { hash } = generateOrderAccessToken();
    const { token: otherToken } = generateOrderAccessToken();
    expect(orderAccessMatches(hash, otherToken)).toBe(false);
  });

  it('hashes tokens deterministically', () => {
    const token = 'abc123';
    expect(hashOrderAccessToken(token)).toBe(hashOrderAccessToken(token));
  });

  it('strips access_token_hash from API payloads', () => {
    const safe = stripOrderSecrets({
      id: '1',
      order_number: 'GSS-1',
      access_token_hash: 'secret-hash',
    });
    expect(safe).toEqual({ id: '1', order_number: 'GSS-1' });
    expect('access_token_hash' in safe).toBe(false);
  });
});
