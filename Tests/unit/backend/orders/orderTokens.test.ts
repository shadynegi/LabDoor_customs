import { describe, it, expect } from 'vitest';
import {
  generateOrderAccessToken,
  getOrderAccessTokenFromRequest,
  hashOrderAccessToken,
  orderAccessMatches,
  stripOrderSecrets,
} from '../../../../backend/src/lib/orderTokens';

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

  it('reads access token from header only (query aid deprecated)', () => {
    const headerReq = {
      headers: { 'x-order-access-token': 'header-token' },
      query: { aid: 'query-token' },
    } as Parameters<typeof getOrderAccessTokenFromRequest>[0];
    expect(getOrderAccessTokenFromRequest(headerReq)).toBe('header-token');

    const queryOnlyReq = {
      headers: {},
      query: { aid: 'query-token' },
    } as Parameters<typeof getOrderAccessTokenFromRequest>[0];
    expect(getOrderAccessTokenFromRequest(queryOnlyReq)).toBeNull();
  });

  it('strips access token secrets from API payloads', () => {
    const safe = stripOrderSecrets({
      id: '1',
      order_number: 'GSS-1',
      access_token_hash: 'secret-hash',
      access_token_encrypted: 'enc:secret-blob',
    });
    expect(safe).toEqual({ id: '1', order_number: 'GSS-1' });
    expect('access_token_hash' in safe).toBe(false);
    expect('access_token_encrypted' in safe).toBe(false);
  });
});
