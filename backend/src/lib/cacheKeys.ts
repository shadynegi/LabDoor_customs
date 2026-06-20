import { invalidateCache, invalidateCachePrefix } from './cache';

/** Central cache key prefixes for invalidation on admin writes. */
export const CACHE = {
  productsList: (page: number, limit: number) => `products:list:${page}:${limit}`,
  productSingle: (id: string | number) => `products:single:${id}`,
  couponValidate: (code: string, subtotal: number, email: string, itemCount = 0) =>
    `coupon:validate:${code.toUpperCase()}:${subtotal}:${email.toLowerCase()}:${itemCount}`,
  adminAnalytics: 'admin:analytics',
  productsPrefix: 'products:',
  couponsValidatePrefix: 'coupon:validate:',
} as const;

const ADMIN_ANALYTICS_TTL_DEFAULT_MS = 10 * 60_000;
const ADMIN_ANALYTICS_TTL_MIN_MS = 5 * 60_000;
const ADMIN_ANALYTICS_TTL_MAX_MS = 15 * 60_000;

/** Admin dashboard analytics cache TTL (clamped 5–15 min; default 10 min). */
export function getAdminAnalyticsCacheTtlMs(): number {
  const raw = parseInt(process.env.ADMIN_ANALYTICS_CACHE_TTL_MS || '', 10);
  if (Number.isNaN(raw)) return ADMIN_ANALYTICS_TTL_DEFAULT_MS;
  return Math.min(ADMIN_ANALYTICS_TTL_MAX_MS, Math.max(ADMIN_ANALYTICS_TTL_MIN_MS, raw));
}

export const TTL = {
  productsList: 60_000,
  productSingle: 120_000,
  couponValidate: 30_000,
  get adminAnalytics() {
    return getAdminAnalyticsCacheTtlMs();
  },
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
