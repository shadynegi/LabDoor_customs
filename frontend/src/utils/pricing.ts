// Shared pricing calculation utilities
// No tax. Shipping fixed at $25; free on orders over $200.

export interface PricingBreakdown {
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

export const FREE_SHIPPING_THRESHOLD = 200;
export const SHIPPING_COST = 25;
export const FREE_SHIPPING_MESSAGE = 'Free Shipping on all orders over $200';

export const calculatePricing = (subtotal: number): PricingBreakdown => {
  const shipping = subtotal > FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
  const total = subtotal + shipping;

  return {
    subtotal: Number(subtotal.toFixed(2)),
    shipping: Number(shipping.toFixed(2)),
    tax: 0,
    total: Number(total.toFixed(2)),
  };
};

export const PRICING_CONSTANTS = {
  FREE_SHIPPING_THRESHOLD,
  SHIPPING_COST,
  FREE_SHIPPING_MESSAGE,
} as const;