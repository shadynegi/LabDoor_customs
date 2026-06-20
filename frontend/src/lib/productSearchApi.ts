import { catalogFetch } from '../config';
import type { Product } from '../hooks/useProducts';
import type { SearchFilters } from '../types/productSearch';

export function normalizeSearchProduct(product: Product): Product {
  return {
    ...product,
    price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
    rating:
      typeof product.rating === 'string'
        ? parseFloat(String(product.rating))
        : product.rating || 0,
    review_count:
      typeof product.review_count === 'string'
        ? parseInt(String(product.review_count), 10)
        : product.review_count || 0,
  };
}

export interface ProductSearchRequest {
  query?: string;
  filters?: SearchFilters;
  page?: number;
  limit?: number;
}

export async function searchProductsApi({
  query = '',
  filters = {},
  page = 1,
  limit = 100,
}: ProductSearchRequest): Promise<Product[]> {
  const hasQuery = query.trim().length > 0;
  const hasFilters =
    filters.category ||
    filters.size ||
    filters.color ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
    filters.minRating !== undefined ||
    (filters.sortBy !== undefined && filters.sortBy !== 'default');

  if (!hasQuery && !hasFilters) {
    return [];
  }

  const response = await catalogFetch('/products/search', {
    method: 'POST',
    body: JSON.stringify({
      query: query.trim() || undefined,
      minPrice: filters.minPrice,
      maxPrice: filters.maxPrice,
      category: filters.category,
      size: filters.size,
      color: filters.color,
      minRating: filters.minRating,
      sortBy: filters.sortBy ?? 'default',
      page,
      limit,
    }),
  });

  if (!response.ok) {
    throw new Error('Search failed');
  }

  const data = await response.json();
  if (!data.success || !Array.isArray(data.data)) {
    throw new Error(data.error || 'Invalid search response');
  }

  return data.data.map(normalizeSearchProduct);
}

export const SUGGESTION_LIMIT = 10;

export async function fetchSearchSuggestions(query: string): Promise<Product[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return searchProductsApi({ query: trimmed, limit: SUGGESTION_LIMIT });
}
