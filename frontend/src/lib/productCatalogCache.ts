import type { Product } from '../hooks/useProducts';

const CACHE_KEY = 'ldc_product_catalog_v1';

/** Clears legacy client-side catalog cache (pre–server-search optimization). */
export function clearProductCatalogCache(): void {
  try {
    localStorage.removeItem(CACHE_KEY);
    window.dispatchEvent(new CustomEvent('ldc:catalog-cleared'));
  } catch {
    // ignore
  }
}

export const CATALOG_CLEARED_EVENT = 'ldc:catalog-cleared';

/** @deprecated Full-catalog client cache removed; kept for admin invalidation only. */
export async function getProductCatalog(_forceRefresh = false): Promise<Product[]> {
  return [];
}

export function normalizeProduct(product: Product): Product {
  return {
    ...product,
    price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
  };
}
