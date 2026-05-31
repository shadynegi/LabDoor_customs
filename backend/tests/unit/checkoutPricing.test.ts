import { describe, it, expect } from 'vitest';
import {
  calculatePricing,
  amountsMatch,
  extractPayPalCaptureAmount,
  validateCartItems,
} from '../../src/lib/paypalCheckout';
import { sqlMock } from '../setup';

describe('checkoutPricing', () => {
  it('calculates shipping and free shipping threshold', () => {
    expect(calculatePricing(100)).toEqual({
      subtotal: 100,
      shipping: 25,
      tax: 0,
      discount: 0,
      total: 125,
    });

    expect(calculatePricing(250)).toEqual({
      subtotal: 250,
      shipping: 0,
      tax: 0,
      discount: 0,
      total: 250,
    });
  });

  it('applies coupon discount before shipping', () => {
    expect(calculatePricing(100, 20)).toEqual({
      subtotal: 100,
      shipping: 25,
      tax: 0,
      discount: 20,
      total: 105,
    });
  });

  it('compares amounts within tolerance', () => {
    expect(amountsMatch(10, 10.005)).toBe(true);
    expect(amountsMatch(10, 10.02)).toBe(false);
  });

  it('extracts capture amount from PayPal payload', () => {
    const amount = extractPayPalCaptureAmount({
      purchase_units: [
        {
          payments: {
            captures: [{ amount: { value: '125.00' } }],
          },
        },
      ],
    });
    expect(amount).toBe(125);
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
