import { catalogFetch } from '../config';
import type { Product } from '../hooks/useProducts';
import { normalizeProduct } from './productCatalogCache';
import type { SearchFilters } from '../types/productSearch';

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
  limit = 10,
}: ProductSearchRequest): Promise<Product[]> {
  const hasQuery = query.trim().length > 0;
  const hasFilters =
    filters.color ||
    filters.minPrice !== undefined ||
    filters.maxPrice !== undefined ||
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
      color: filters.color,
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

  return data.data.map(normalizeProduct);
}

export const SUGGESTION_LIMIT = 10;

export async function fetchSearchSuggestions(query: string): Promise<Product[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  return searchProductsApi({ query: trimmed, limit: SUGGESTION_LIMIT });
}
