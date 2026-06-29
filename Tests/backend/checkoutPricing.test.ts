import { describe, it, expect } from 'vitest';
import {
  calculateCheckoutPricing,
  calculatePricing,
  calculateVolumeDiscount,
  amountsMatch,
  validateCartItems,
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
} from '../../backend/src/lib/checkoutPricing';
import { sqlMock } from '../setup';

describe('checkoutPricing', () => {
  it('charges shipping one cent below free-shipping threshold', () => {
    expect(calculateCheckoutPricing(FREE_SHIPPING_THRESHOLD - 0.01, 1)).toEqual({
      subtotal: FREE_SHIPPING_THRESHOLD - 0.01,
      shipping: SHIPPING_COST,
      tax: 0,
      volumeDiscount: 0,
      volumeDiscountPercent: 0,
      couponDiscount: 0,
      discount: 0,
      total: FREE_SHIPPING_THRESHOLD - 0.01 + SHIPPING_COST,
    });
  });

  it('charges fixed shipping well below free-shipping threshold', () => {
    expect(calculateCheckoutPricing(100, 1)).toEqual({
      subtotal: 100,
      shipping: SHIPPING_COST,
      tax: 0,
      volumeDiscount: 0,
      volumeDiscountPercent: 0,
      couponDiscount: 0,
      discount: 0,
      total: 100 + SHIPPING_COST,
    });
  });

  it('offers free shipping at threshold', () => {
    expect(calculateCheckoutPricing(FREE_SHIPPING_THRESHOLD, 1)).toEqual({
      subtotal: FREE_SHIPPING_THRESHOLD,
      shipping: 0,
      tax: 0,
      volumeDiscount: 0,
      volumeDiscountPercent: 0,
      couponDiscount: 0,
      discount: 0,
      total: FREE_SHIPPING_THRESHOLD,
    });
  });

  it('applies 10% volume discount for 2+ items', () => {
    expect(calculateCheckoutPricing(150, 2)).toEqual({
      subtotal: 150,
      shipping: SHIPPING_COST,
      tax: 0,
      volumeDiscount: 15,
      volumeDiscountPercent: 10,
      couponDiscount: 0,
      discount: 15,
      total: 135 + SHIPPING_COST,
    });
  });

  it('applies 20% volume discount for 5+ items', () => {
    expect(calculateCheckoutPricing(150, 5)).toEqual({
      subtotal: 150,
      shipping: SHIPPING_COST,
      tax: 0,
      volumeDiscount: 30,
      volumeDiscountPercent: 20,
      couponDiscount: 0,
      discount: 30,
      total: 120 + SHIPPING_COST,
    });
  });

  it('stacks coupon discount after volume discount', () => {
    expect(calculateCheckoutPricing(100, 2, 9)).toEqual({
      subtotal: 100,
      shipping: SHIPPING_COST,
      tax: 0,
      volumeDiscount: 10,
      volumeDiscountPercent: 10,
      couponDiscount: 9,
      discount: 19,
      total: 81 + SHIPPING_COST,
    });
  });

  it('legacy calculatePricing applies coupon-only discount without volume tiers', () => {
    expect(calculatePricing(100, 20)).toEqual({
      subtotal: 100,
      shipping: SHIPPING_COST,
      tax: 0,
      volumeDiscount: 0,
      volumeDiscountPercent: 0,
      couponDiscount: 20,
      discount: 20,
      total: 105,
    });
  });

  it('calculateVolumeDiscount tiers', () => {
    expect(calculateVolumeDiscount(100, 1)).toEqual({ percent: 0, amount: 0 });
    expect(calculateVolumeDiscount(100, 2)).toEqual({ percent: 10, amount: 10 });
    expect(calculateVolumeDiscount(100, 5)).toEqual({ percent: 20, amount: 20 });
  });

  it('compares amounts within tolerance', () => {
    expect(amountsMatch(10, 10.005)).toBe(true);
    expect(amountsMatch(10, 10.02)).toBe(false);
  });
});

describe('validateCartItems', () => {
  it('rejects empty cart', async () => {
    const result = await validateCartItems([]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe('Empty cart');
    }
  });

  it('validates product stock from database', async () => {
    sqlMock.mockResolvedValueOnce([
      {
        id: 1,
        name: 'Test Shoe',
        price: '99.00',
        image: '/img.png',
        stock: 5,
        is_out_of_stock: false,
      },
    ]);

    const result = await validateCartItems([{ product_id: 1, quantity: 2 }]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.lineItems[0].price).toBe(99);
      expect(result.lineItems[0].product_name).toBe('Test Shoe');
    }
  });
});
