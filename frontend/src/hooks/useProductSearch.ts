// Custom hook for client-side product search (Fuse.js) and filters
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { catalogFetch } from '../config';
import type { Product } from './useProducts';
import { CATALOG_CLEARED_EVENT, getProductCatalog } from '../lib/productCatalogCache';
import {
  createProductFuse,
  fuseSearchProducts,
  searchProductCatalog,
  SUGGESTION_LIMIT,
} from '../lib/productFuseSearch';
import type { SearchFilters, FilterOptions, SortOption } from '../types/productSearch';
import { logError } from '../lib/logger';
import { trackFilterApply, trackSearch } from '../utils/activityTracker';

export type { SearchFilters, FilterOptions, SortOption };

interface UseProductSearchResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  results: Product[];
  suggestions: Product[];
  loading: boolean;
  catalogLoading: boolean;
  error: string | null;
  isSearching: boolean;
  isFiltering: boolean;
  clearSearch: () => void;
  clearFilters: () => void;
  clearAll: () => void;
  filters: SearchFilters;
  setFilters: (filters: SearchFilters) => void;
  updateFilter: <K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => void;
  filterOptions: FilterOptions | null;
  loadingFilterOptions: boolean;
  activeFilterCount: number;
  ensureCatalogLoaded: () => Promise<void>;
  ensureFilterOptionsLoaded: () => Promise<void>;
}

const DEFAULT_FILTERS: SearchFilters = {};

/**
 * Client-side product search with Fuse.js typo tolerance.
 * Catalog is fetched once and cached in localStorage for 15 minutes.
 */
export const useProductSearch = (debounceMs: number = 300): UseProductSearchResult => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false);
  const fuseRef = useRef<ReturnType<typeof createProductFuse> | null>(null);
  const catalogLoadedRef = useRef(false);
  const filtersLoadedRef = useRef(false);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.category) count++;
    if (filters.size) count++;
    if (filters.color) count++;
    if (filters.minRating !== undefined) count++;
    return count;
  }, [filters]);

  const isFiltering = activeFilterCount > 0 || (filters.sortBy !== undefined && filters.sortBy !== 'default');

  const ensureCatalogLoaded = useCallback(async (force = false) => {
    if (catalogLoadedRef.current && !force) return;

    try {
      setCatalogLoading(true);
      setError(null);
      const products = await getProductCatalog(force);
      catalogLoadedRef.current = true;
      setCatalog(products);
      fuseRef.current = createProductFuse(products);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load products');
      setCatalog([]);
      fuseRef.current = null;
      catalogLoadedRef.current = false;
    } finally {
      setCatalogLoading(false);
    }
  }, []);

  const ensureFilterOptionsLoaded = useCallback(async () => {
    if (filtersLoadedRef.current) return;

    try {
      setLoadingFilterOptions(true);
      const response = await catalogFetch('/products/filters');

      if (!response.ok) {
        throw new Error('Failed to fetch filter options');
      }

      const data = await response.json();
      if (data.success && data.data) {
        setFilterOptions(data.data);
      }
      filtersLoadedRef.current = true;
    } catch (err) {
      logError('Error fetching filter options:', err);
      setFilterOptions({
        categories: [],
        sizes: [],
        colors: [],
        priceRange: { min: 0, max: 500 },
        ratingRange: { min: 0, max: 5, avg: 0 },
        sortOptions: [
          { value: 'default', label: 'Default' },
          { value: 'price_asc', label: 'Price: Low to High' },
          { value: 'price_desc', label: 'Price: High to Low' },
          { value: 'rating_desc', label: 'Highest Rated' },
          { value: 'newest', label: 'Newest First' },
          { value: 'oldest', label: 'Oldest First' },
        ],
      });
      filtersLoadedRef.current = true;
    } finally {
      setLoadingFilterOptions(false);
    }
  }, []);

  useEffect(() => {
    const onCatalogCleared = () => {
      catalogLoadedRef.current = false;
      filtersLoadedRef.current = false;
      void ensureCatalogLoaded(true);
      void ensureFilterOptionsLoaded();
    };
    window.addEventListener(CATALOG_CLEARED_EVENT, onCatalogCleared);
    return () => window.removeEventListener(CATALOG_CLEARED_EVENT, onCatalogCleared);
  }, [ensureCatalogLoaded, ensureFilterOptionsLoaded]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  useEffect(() => {
    if (debouncedQuery.trim() || isFiltering) {
      void ensureCatalogLoaded();
    }
    if (isFiltering) {
      void ensureFilterOptionsLoaded();
    }
  }, [debouncedQuery, isFiltering, ensureCatalogLoaded, ensureFilterOptionsLoaded]);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || !fuseRef.current) return [];
    return fuseSearchProducts(fuseRef.current, searchQuery, SUGGESTION_LIMIT);
  }, [searchQuery, catalog]);

  useEffect(() => {
    const hasQuery = debouncedQuery.trim().length > 0;
    const hasFilters = isFiltering;

    if (!hasQuery && !hasFilters) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    if (catalogLoading) {
      setLoading(true);
      return;
    }

    if (catalog.length === 0) {
      setResults([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextResults = searchProductCatalog(
        catalog,
        debouncedQuery,
        filters,
        hasFilters
      );
      setResults(nextResults);
      if (hasQuery) {
        trackSearch(debouncedQuery.trim(), nextResults.length);
      }
      if (hasFilters) {
        trackFilterApply(filters as Record<string, unknown>);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedQuery, filters, isFiltering, catalog, catalogLoading]);

  const updateFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const clearAll = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setError(null);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    results,
    suggestions,
    loading: loading || catalogLoading,
    catalogLoading,
    error,
    isSearching: searchQuery.trim().length > 0,
    isFiltering,
    clearSearch,
    clearFilters,
    clearAll,
    filters,
    setFilters,
    updateFilter,
    filterOptions,
    loadingFilterOptions,
    activeFilterCount,
    ensureCatalogLoaded,
    ensureFilterOptionsLoaded,
  };
};
