import sql from './db';
import { InsufficientStockError } from './inventory';

export const FREE_SHIPPING_THRESHOLD = 200;
export const SHIPPING_COST = 25;

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

function roundMoney(value: number): number {
  return Number(value.toFixed(2));
}

/** Automatic multi-item discount: 10% at 2+ items, 20% at 5+ items (quantity sum). */
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

export interface CheckoutCartItemInput {
  product_id: number;
  quantity: number;
  size_system?: string;
  size_value?: string;
}

export interface ValidatedLineItem {
  product_id: number;
  product_name: string;
  product_image?: string;
  quantity: number;
  price: number;
  size_system?: string;
  size_value?: string;
}

export type { PendingOrderInput } from './orderLifecycle';
export { createPendingOrderAtomic, cancelPendingOrderAndRestoreStock } from './orderLifecycle';

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

/** @deprecated Use calculateCheckoutPricing — kept for tests expecting coupon-only discount. */
export function calculatePricing(subtotal: number, discount = 0): PricingBreakdown {
  return calculateCheckoutPricing(subtotal, 0, discount);
}

export type ComputedCheckoutPricing = {
  pricing: PricingBreakdown;
  lineItems: ValidatedLineItem[];
  couponId?: string;
  couponDiscount: number;
};

/** Shared pricing path for checkout and coupon validate (DB-backed cart). */
export async function computeCheckoutPricingForCart(
  items: CheckoutCartItemInput[],
  couponCode?: string,
  customerEmail?: string
): Promise<
  | { ok: true; result: ComputedCheckoutPricing }
  | { ok: false; error: string; message: string }
> {
  const cartValidation = await validateCartItems(items);
  if (!cartValidation.ok) {
    return { ok: false, error: cartValidation.error, message: cartValidation.message };
  }

  const lineItems = cartValidation.lineItems;
  const rawSubtotal = lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalItemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);
  const volumePreview = calculateVolumeDiscount(rawSubtotal, totalItemCount);
  const couponSubtotal = Math.max(0, rawSubtotal - volumePreview.amount);

  let couponDiscount = 0;
  let couponId: string | undefined;
  if (couponCode?.trim()) {
    try {
      const couponResult = await resolveCouponDiscount(
        couponCode,
        couponSubtotal,
        customerEmail || '',
        lineItems.map((item) => ({
          product_id: item.product_id,
          price: item.price,
          quantity: item.quantity,
        }))
      );
      couponDiscount = couponResult.discount;
      couponId = couponResult.couponId;
    } catch (couponError: unknown) {
      const message =
        couponError instanceof Error ? couponError.message : 'Invalid coupon';
      return { ok: false, error: 'Invalid coupon', message };
    }
  }

  const pricing = calculateCheckoutPricing(rawSubtotal, totalItemCount, couponDiscount);
  return {
    ok: true,
    result: { pricing, lineItems, couponId, couponDiscount },
  };
}

export async function validateCartItems(
  items: CheckoutCartItemInput[]
): Promise<{ ok: true; lineItems: ValidatedLineItem[] } | { ok: false; error: string; message: string }> {
  if (!items || items.length === 0) {
    return { ok: false, error: 'Empty cart', message: 'Your cart is empty' };
  }

  const lineItems: ValidatedLineItem[] = [];

  for (const item of items) {
    if (!item.product_id || !item.quantity || item.quantity < 1) {
      return { ok: false, error: 'Invalid item', message: 'Each cart item must include product_id and quantity' };
    }

    const result = await sql`
      SELECT id, name, price, image, stock, is_out_of_stock
      FROM products
      WHERE id = ${item.product_id}
    `;

    if (!result || result.length === 0) {
      return { ok: false, error: 'Product not found', message: `Product ${item.product_id} was not found` };
    }

    const product = result[0];
    if (product.is_out_of_stock || product.stock < item.quantity) {
      return {
        ok: false,
        error: 'Insufficient stock',
        message: `${product.name} is out of stock or has insufficient quantity`,
      };
    }

    lineItems.push({
      product_id: product.id,
      product_name: product.name,
      product_image: product.image || undefined,
      quantity: item.quantity,
      price: parseFloat(product.price?.toString() || '0'),
      size_system: item.size_system,
      size_value: item.size_value,
    });
  }

  return { ok: true, lineItems };
}

export interface CouponCartLineItem {
  product_id: number;
  price: number;
  quantity: number;
}

async function computeEligibleSubtotal(
  coupon: Record<string, unknown>,
  lineItems: CouponCartLineItem[]
): Promise<number> {
  const appliesTo = (coupon.applies_to as string) || 'all';
  const appliesToIds = (coupon.applies_to_ids as number[] | null) || [];

  if (appliesTo === 'all') {
    if (lineItems.length > 0) {
      return lineItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
    }
    return 0;
  }

  if (appliesToIds.length === 0) {
    throw new Error('This coupon is not configured correctly');
  }

  if (lineItems.length === 0) {
    throw new Error('Cart items are required to validate this coupon');
  }

  if (appliesTo === 'product') {
    const eligible = lineItems.filter((item) => appliesToIds.includes(item.product_id));
    if (eligible.length === 0) {
      throw new Error('This coupon does not apply to items in your cart');
    }
    return eligible.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  if (appliesTo === 'category') {
    const seedProducts = await sql`
      SELECT DISTINCT category FROM products WHERE id = ANY(${appliesToIds}::int[])
    `;
    const allowedCategories = new Set(
      seedProducts.map((row) => row.category).filter((cat): cat is string => Boolean(cat))
    );

    if (allowedCategories.size === 0) {
      throw new Error('This coupon is not configured correctly');
    }

    const cartProductIds = lineItems.map((item) => item.product_id);
    const cartProducts = await sql`
      SELECT id, category FROM products WHERE id = ANY(${cartProductIds}::int[])
    `;
    const categoryByProduct = new Map<number, string | null>(
      cartProducts.map((row) => [row.id as number, (row.category as string) || null])
    );

    const eligible = lineItems.filter((item) => {
      const category = categoryByProduct.get(item.product_id);
      return category != null && allowedCategories.has(category);
    });

    if (eligible.length === 0) {
      throw new Error('This coupon does not apply to items in your cart');
    }

    return eligible.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  return 0;
}

export async function resolveCouponDiscount(
  couponCode: string | undefined,
  subtotal: number,
  customerEmail: string,
  lineItems: CouponCartLineItem[] = []
): Promise<{ discount: number; couponId?: string; couponCode?: string }> {
  if (!couponCode?.trim()) {
    return { discount: 0 };
  }

  const coupons = await sql`
    SELECT * FROM coupons
    WHERE UPPER(code) = UPPER(${couponCode.trim()})
    LIMIT 1
  `;

  if (!coupons || coupons.length === 0) {
    throw new Error('Invalid coupon code');
  }

  const coupon = coupons[0];
  if (!coupon.is_active) throw new Error('This coupon is no longer active');

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) throw new Error('This coupon is not yet valid');
  if (coupon.valid_until && new Date(coupon.valid_until) < now) throw new Error('This coupon has expired');
  if (coupon.max_uses != null && coupon.used_count >= coupon.max_uses) {
    throw new Error('This coupon has reached its usage limit');
  }
  if (coupon.minimum_order && subtotal < parseFloat(coupon.minimum_order.toString())) {
    throw new Error(`Minimum order of $${parseFloat(coupon.minimum_order.toString()).toFixed(2)} required`);
  }

  const eligibleSubtotal =
    lineItems.length > 0
      ? await computeEligibleSubtotal(coupon, lineItems)
      : subtotal;

  if (coupon.applies_to && coupon.applies_to !== 'all' && eligibleSubtotal <= 0) {
    throw new Error('This coupon does not apply to items in your cart');
  }

  if (coupon.minimum_order && eligibleSubtotal < parseFloat(coupon.minimum_order.toString())) {
    throw new Error(`Minimum order of $${parseFloat(coupon.minimum_order.toString()).toFixed(2)} required for eligible items`);
  }

  if (customerEmail && coupon.id && coupon.max_uses_per_customer != null) {
    const usageCount = await sql`
      SELECT COUNT(*) as count FROM coupon_usage
      WHERE coupon_id = ${coupon.id} AND customer_email = ${customerEmail}
    `;
    if (parseInt(usageCount[0].count) >= coupon.max_uses_per_customer) {
      throw new Error('You have already used this coupon the maximum number of times');
    }
  }

  let discount = 0;
  if (coupon.discount_type === 'percentage') {
    discount = (eligibleSubtotal * parseFloat(coupon.discount_value.toString())) / 100;
    if (coupon.maximum_discount && discount > parseFloat(coupon.maximum_discount.toString())) {
      discount = parseFloat(coupon.maximum_discount.toString());
    }
  } else {
    discount = Math.min(parseFloat(coupon.discount_value.toString()), eligibleSubtotal);
  }

  return {
    discount: Math.round(discount * 100) / 100,
    couponId: coupon.id,
    couponCode: coupon.code,
  };
}

export { InsufficientStockError };

export function amountsMatch(expected: number, actual: number, tolerance = 0.01): boolean {
  return Math.abs(expected - actual) <= tolerance;
}
