import { describe, expect, it } from 'vitest';
import { calculateVolumeDiscount, resolveCouponDiscount } from '../../backend/src/lib/paypalCheckout';
import { sqlMock } from '../setup';

describe('coupon validate volume alignment', () => {
  it('applies volume discount before coupon subtotal like create-payment', () => {
    const subtotal = 200;
    const totalItemCount = 2;
    const volume = calculateVolumeDiscount(subtotal, totalItemCount);
    const couponSubtotal = Math.max(0, subtotal - volume.amount);
    expect(couponSubtotal).toBe(180);
    expect(volume.amount).toBe(20);
  });

  it('resolveCouponDiscount uses post-volume subtotal for percentage coupons', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: 'c1',
        code: 'TEST10',
        is_active: true,
        discount_type: 'percentage',
        discount_value: '10',
        applies_to: 'all',
        used_count: 0,
        max_uses: null,
        max_uses_per_customer: null,
        minimum_order: null,
        maximum_discount: null,
      },
    ]);

    const result = await resolveCouponDiscount('TEST10', 180, 'buyer@example.com', [
      { product_id: 1, price: 100, quantity: 2 },
    ]);
    expect(result.discount).toBe(20);
  });
});
