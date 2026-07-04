// Server-backed product search and suggestions (replaces client-side Fuse.js catalog)
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { catalogFetch } from '../config';
import type { Product } from './useProducts';
import { searchProductsApi } from '../lib/productSearchApi';
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

export const useProductSearch = (debounceMs: number = 300): UseProductSearchResult => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false);
  const filtersLoadedRef = useRef(false);
  const suggestionRequestRef = useRef(0);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.minPrice !== undefined) count++;
    if (filters.maxPrice !== undefined) count++;
    if (filters.color) count++;
    return count;
  }, [filters]);

  const isFiltering =
    activeFilterCount > 0 || (filters.sortBy !== undefined && filters.sortBy !== 'default');

  const ensureCatalogLoaded = useCallback(async () => {
    // No-op: catalog is no longer prefetched client-side
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
        sizes: [],
        colors: [],
        priceRange: { min: 0, max: 500 },
        sortOptions: [
          { value: 'default', label: 'Default' },
          { value: 'price_asc', label: 'Price: Low to High' },
          { value: 'price_desc', label: 'Price: High to Low' },
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
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), debounceMs);
    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  useEffect(() => {
    if (isFiltering) {
      void ensureFilterOptionsLoaded();
    }
  }, [isFiltering, ensureFilterOptionsLoaded]);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSuggestions([]);
      return;
    }

    const requestId = ++suggestionRequestRef.current;
    const timer = setTimeout(async () => {
      try {
        setSuggestionsLoading(true);
        const { fetchSearchSuggestions } = await import('../lib/productSearchApi');
        const next = await fetchSearchSuggestions(trimmed);
        if (requestId === suggestionRequestRef.current) {
          setSuggestions(next);
        }
      } catch {
        if (requestId === suggestionRequestRef.current) {
          setSuggestions([]);
        }
      } finally {
        if (requestId === suggestionRequestRef.current) {
          setSuggestionsLoading(false);
        }
      }
    }, Math.min(debounceMs, 200));

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  useEffect(() => {
    const hasQuery = debouncedQuery.trim().length > 0;
    const hasFilters = isFiltering;

    if (!hasQuery && !hasFilters) {
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setError(null);
      try {
        const nextResults = await searchProductsApi({
          query: debouncedQuery,
          filters,
          limit: 10,
        });
        if (!cancelled) {
          setResults(nextResults);
          if (hasQuery) {
            trackSearch(debouncedQuery.trim(), nextResults.length);
          }
          if (hasFilters) {
            trackFilterApply(filters as Record<string, unknown>);
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Search failed');
          setResults([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery, filters, isFiltering]);

  const updateFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setSuggestions([]);
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const clearAll = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
    setFilters(DEFAULT_FILTERS);
    setResults([]);
    setSuggestions([]);
    setError(null);
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    results,
    suggestions,
    loading: loading || suggestionsLoading,
    catalogLoading: false,
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
