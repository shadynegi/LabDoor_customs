// Shared pricing calculation utilities (mirror backend/src/lib/checkoutPricing.ts)
// No tax. Shipping $25 fixed; free when merchandise subtotal is $200+.

export interface PricingBreakdown {
  subtotal: number;
  shipping: number;
  tax: number;
  volumeDiscount: number;
  volumeDiscountPercent: number;
  couponDiscount: number;
  discount: number;
  total: number;
}

export const FREE_SHIPPING_THRESHOLD = 200;
export const SHIPPING_COST = 25;
export const FREE_SHIPPING_MESSAGE = 'Free shipping on orders over $200';
export const PROMO_COUPON_CODE = 'LDCOFF10';
export const PROMO_COUPON_MESSAGE = 'Use code LDCOFF10 for 10% off — enter it below and click Apply';
export const VOLUME_DISCOUNT_INFO = {
  twoPlus: 'Order 2 or more items to get 10% off your order total',
  fivePlus: 'Order 5 or more items to get 20% off your order total',
} as const;

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

export function calculateVolumeDiscount(
  subtotal: number,
  totalItemCount: number
): { percent: number; amount: number } {
  if (totalItemCount >= 5) {
    return { percent: 20, amount: roundMoney(subtotal * 0.2) };
  }
  if (totalItemCount >= 2) {
    return { percent: 10, amount: roundMoney(subtotal * 0.1) };
  }
  return { percent: 0, amount: 0 };
}

export function calculateCheckoutPricing(
  subtotal: number,
  totalItemCount: number,
  couponDiscount = 0
): PricingBreakdown {
  const volume = calculateVolumeDiscount(subtotal, totalItemCount);
  const afterVolume = Math.max(0, subtotal - volume.amount);
  const coupon = Math.min(Math.max(0, couponDiscount), afterVolume);
  const totalDiscount = volume.amount + coupon;
  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = Math.max(0, subtotal - totalDiscount) + shipping;

  return {
    subtotal: roundMoney(subtotal),
    shipping: roundMoney(shipping),
    tax: 0,
    volumeDiscount: volume.amount,
    volumeDiscountPercent: volume.percent,
    couponDiscount: roundMoney(coupon),
    discount: roundMoney(totalDiscount),
    total: roundMoney(total),
  };
}

