import { describe, expect, it } from 'vitest';
import { hashCheckoutExchangeCode } from '../../backend/src/lib/orderCheckoutExchange';

describe('orderCheckoutExchange', () => {
  it('hashes codes deterministically', () => {
    const a = hashCheckoutExchangeCode('test-code-abc');
    const b = hashCheckoutExchangeCode('test-code-abc');
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
  });

  it('produces different hashes for different codes', () => {
    const a = hashCheckoutExchangeCode('code-one');
    const b = hashCheckoutExchangeCode('code-two');
    expect(a).not.toBe(b);
  });
});
