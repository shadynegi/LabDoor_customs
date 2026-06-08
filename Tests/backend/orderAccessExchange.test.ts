import { describe, expect, it } from 'vitest';
import { hashOrderAccessExchangeCode } from '../../backend/src/lib/orderAccessExchange';

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
});
