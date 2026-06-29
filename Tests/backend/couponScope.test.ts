import { describe, it, expect, beforeEach } from 'vitest';
import { resolveCouponDiscount } from '../../backend/src/lib/checkoutPricing';
import { sqlMock } from '../setup';

describe('coupon applies_to scope', () => {
  beforeEach(() => {
    sqlMock.mockReset();
    sqlMock.mockResolvedValue([]);
  });

  it('rejects product-scoped coupon when cart has no eligible products', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: 'coupon-prod',
        code: 'PRODONLY',
        is_active: true,
        discount_type: 'percentage',
        discount_value: '10',
        applies_to: 'product',
        applies_to_ids: [99],
        used_count: 0,
        max_uses: null,
        max_uses_per_customer: null,
        minimum_order: null,
        maximum_discount: null,
        valid_from: null,
        valid_until: null,
      },
    ]);

    await expect(
      resolveCouponDiscount('PRODONLY', 100, 'buyer@example.com', [
        { product_id: 1, price: 100, quantity: 1 },
      ])
    ).rejects.toThrow(/does not apply to items in your cart/i);
  });

  it('applies product-scoped coupon only to matching line items', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: 'coupon-prod',
        code: 'PRODONLY',
        is_active: true,
        discount_type: 'percentage',
        discount_value: '10',
        applies_to: 'product',
        applies_to_ids: [1],
        used_count: 0,
        max_uses: null,
        max_uses_per_customer: null,
        minimum_order: null,
        maximum_discount: null,
        valid_from: null,
        valid_until: null,
      },
    ]);

    const result = await resolveCouponDiscount('PRODONLY', 150, 'buyer@example.com', [
      { product_id: 1, price: 100, quantity: 1 },
      { product_id: 2, price: 50, quantity: 1 },
    ]);

    expect(result.discount).toBe(10);
    expect(result.couponCode).toBe('PRODONLY');
  });
});
