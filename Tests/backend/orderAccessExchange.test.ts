import { describe, expect, it, beforeEach, vi } from 'vitest';
import {
  getOrderAccessTokenForEmail,
  hashOrderAccessExchangeCode,
} from '../../backend/src/lib/orderAccessExchange';
import { sqlMock } from '../setup';

vi.mock('../../backend/src/lib/orderTokenEncryption', () => ({
  decryptOrderAccessToken: (value: string) => (value.startsWith('enc:') ? value.slice(4) : null),
  encryptOrderAccessToken: (value: string) => `enc:${value}`,
}));

describe('orderAccessExchange', () => {
  it('hashes codes deterministically', () => {
    const a = hashOrderAccessExchangeCode('tracking-code-abc');
    const b = hashOrderAccessExchangeCode('tracking-code-abc');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('produces different hashes for different codes', () => {
    const a = hashOrderAccessExchangeCode('code-one');
    const b = hashOrderAccessExchangeCode('code-two');
    expect(a).not.toBe(b);
  });

  describe('getOrderAccessTokenForEmail', () => {
    beforeEach(() => {
      sqlMock.mockReset();
    });

    it('reads durable access_token_encrypted first', async () => {
      sqlMock.mockResolvedValueOnce([{ access_token_encrypted: 'enc:token-from-order' }]);

      const token = await getOrderAccessTokenForEmail('00000000-0000-0000-0000-000000000001');

      expect(token).toBe('token-from-order');
      expect(sqlMock).toHaveBeenCalledTimes(1);
    });
  });
});
