import { describe, it, expect, beforeEach } from 'vitest';
import { computeCheckoutPricingForCart } from '../../backend/src/lib/paypalCheckout';
import { sqlMock } from '../setup';

describe('computeCheckoutPricingForCart', () => {
  beforeEach(() => {
    sqlMock.mockReset();
  });

  it('uses database prices instead of client subtotal', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Test Shoe',
        price: '120.00',
        image: '/img.png',
        stock: 5,
        is_out_of_stock: false,
      },
    ]);

    const result = await computeCheckoutPricingForCart(
      [{ product_id: 1, quantity: 2 }],
      undefined,
      'buyer@example.com'
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.result.pricing.subtotal).toBe(240);
    }
  });
});
