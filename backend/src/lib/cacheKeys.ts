import { invalidateCache, invalidateCachePrefix } from './cache';

/** Central cache key prefixes for invalidation on admin writes. */
export const CACHE = {
  productsList: (page: number, limit: number) => `products:list:${page}:${limit}`,
  productSingle: (id: string | number) => `products:single:${id}`,
  couponValidate: (code: string, subtotal: number, email: string) =>
    `coupon:validate:${code.toUpperCase()}:${subtotal}:${email.toLowerCase()}`,
  productsPrefix: 'products:',
  couponsValidatePrefix: 'coupon:validate:',
} as const;

export const TTL = {
  productsList: 60_000,
  productSingle: 120_000,
  couponValidate: 30_000,
} as const;

export function invalidateProductCaches(productId?: string | number): void {
  invalidateCachePrefix(CACHE.productsPrefix);
  if (productId !== undefined) {
    invalidateCache(CACHE.productSingle(productId));
  }
}

export function invalidateCouponCaches(): void {
  invalidateCachePrefix(CACHE.couponsValidatePrefix);
}
