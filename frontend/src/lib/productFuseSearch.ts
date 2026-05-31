import Fuse, { type IFuseOptions } from 'fuse.js';
import type { Product } from '../hooks/useProducts';
import type { SearchFilters, SortOption } from '../types/productSearch';

export const FUSE_OPTIONS: IFuseOptions<Product> = {
  keys: ['name', 'description', 'category'],
  threshold: 0.3,
  ignoreLocation: true,
};

export const SUGGESTION_LIMIT = 10;

export function createProductFuse(products: Product[]): Fuse<Product> {
  return new Fuse(products, FUSE_OPTIONS);
}

export function fuseSearchProducts(
  fuse: Fuse<Product>,
  query: string,
  limit = SUGGESTION_LIMIT
): Product[] {
  const trimmed = query.trim();
  if (!trimmed) return [];

  return fuse.search(trimmed).slice(0, limit).map((result) => result.item);
}

export function applyProductFilters(products: Product[], filters: SearchFilters): Product[] {
  return products.filter((product) => {
    if (filters.category && product.category !== filters.category) return false;
    if (filters.size && product.size !== filters.size) return false;
    if (filters.color && product.color !== filters.color) return false;
    if (filters.minPrice !== undefined && product.price < filters.minPrice) return false;
    if (filters.maxPrice !== undefined && product.price > filters.maxPrice) return false;
    if (filters.minRating !== undefined && (product.rating || 0) < filters.minRating) return false;
    return true;
  });
}

export function sortProducts(products: Product[], sortBy: SortOption = 'default'): Product[] {
  const sorted = [...products];

  switch (sortBy) {
    case 'price_asc':
      return sorted.sort((a, b) => a.price - b.price);
    case 'price_desc':
      return sorted.sort((a, b) => b.price - a.price);
    case 'rating_desc':
      return sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'newest':
      return sorted.sort((a, b) =>
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      );
    case 'oldest':
      return sorted.sort((a, b) =>
        new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
      );
    default:
      return sorted.sort((a, b) => a.id - b.id);
  }
}

export function searchProductCatalog(
  catalog: Product[],
  query: string,
  filters: SearchFilters,
  isFiltering: boolean
): Product[] {
  const filtered = applyProductFilters(catalog, filters);
  const trimmedQuery = query.trim();

  if (trimmedQuery) {
    const fuse = createProductFuse(filtered);
    return fuse.search(trimmedQuery).map((result) => result.item);
  }

  if (isFiltering) {
    return sortProducts(filtered, filters.sortBy);
  }

  return [];
}
