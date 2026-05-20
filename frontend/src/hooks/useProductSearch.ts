// Custom hook for searching and filtering products with debouncing
import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { apiFetch } from '../config';
import type { Product } from './useProducts';

// Import actual product images
import blueNikeImg from "../assets/Shoe_Design/blue nike.png";
import goldBlackNikeImg from "../assets/Shoe_Design/gold black nike.png";
import pinkNikeImg from "../assets/Shoe_Design/pink nike.png";
import blackBrownNikeImg from "../assets/Shoe_Design/black and brown nike.png";
import brownPinkNikeImg from "../assets/Shoe_Design/brown pink nike.png";
import blueBg from "../assets/Backgrounds/blue.png";
import goldBg from "../assets/Backgrounds/gold.png";
import pinkBg from "../assets/Backgrounds/pink.png";
import brownBg from "../assets/Backgrounds/brown.png";
import brownPinkBg from "../assets/Backgrounds/brown pink.png";

// Map database image references to actual imported images
const imageMap: Record<string, string> = {
  '/assets/blue-nike.png': blueNikeImg,
  '/assets/gold-black-nike.png': goldBlackNikeImg,
  '/assets/pink-nike.png': pinkNikeImg,
  '/assets/black-brown-nike.png': blackBrownNikeImg,
  '/assets/brown-pink-nike.png': brownPinkNikeImg,
};

const backgroundMap: Record<string, string> = {
  '/assets/blue-bg.png': blueBg,
  '/assets/gold-bg.png': goldBg,
  '/assets/pink-bg.png': pinkBg,
  '/assets/brown-bg.png': brownBg,
  '/assets/brown-pink-bg.png': brownPinkBg,
};

export type SortOption = 'default' | 'price_asc' | 'price_desc' | 'rating_desc' | 'newest' | 'oldest';

export interface SearchFilters {
  minPrice?: number;
  maxPrice?: number;
  category?: string;
  size?: string;
  color?: string;
  minRating?: number;
  sortBy?: SortOption;
}

export interface FilterOptions {
  categories: string[];
  sizes: string[];
  colors: string[];
  priceRange: { min: number; max: number };
  ratingRange: { min: number; max: number; avg: number };
  sortOptions: { value: SortOption; label: string }[];
}

interface UseProductSearchResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  results: Product[];
  loading: boolean;
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
}

const DEFAULT_FILTERS: SearchFilters = {};

/**
 * Hook to search and filter products with debouncing
 * Calls the backend search API after a delay to avoid excessive requests
 */
export const useProductSearch = (debounceMs: number = 300): UseProductSearchResult => {
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SearchFilters>(DEFAULT_FILTERS);
  const [filterOptions, setFilterOptions] = useState<FilterOptions | null>(null);
  const [loadingFilterOptions, setLoadingFilterOptions] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Calculate active filter count (excluding sortBy which is always present)
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

  // Check if any filters are active
  const isFiltering = activeFilterCount > 0 || (filters.sortBy && filters.sortBy !== 'default');

  // Fetch available filter options on mount
  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        setLoadingFilterOptions(true);
        const response = await apiFetch('/products/filters');
        
        if (!response.ok) {
          throw new Error('Failed to fetch filter options');
        }

        const data = await response.json();
        if (data.success && data.data) {
          setFilterOptions(data.data);
        }
      } catch (err) {
        console.error('Error fetching filter options:', err);
        // Set default filter options on error
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
            { value: 'oldest', label: 'Oldest First' }
          ]
        });
      } finally {
        setLoadingFilterOptions(false);
      }
    };

    fetchFilterOptions();
  }, []);

  // Debounce the search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  // Perform search when debounced query or filters change
  useEffect(() => {
    const performSearch = async () => {
      // If no query and no filters, clear results
      const hasQuery = debouncedQuery.trim().length > 0;
      const hasFilters = isFiltering;
      
      if (!hasQuery && !hasFilters) {
        setResults([]);
        setError(null);
        return;
      }

      // Cancel any pending request
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller for this request
      abortControllerRef.current = new AbortController();

      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch('/products/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: debouncedQuery || undefined,
            ...filters,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error('Failed to search products');
        }

        const data = await response.json();

        if (data.success && data.data) {
          // Map database image paths to actual imported images and convert price to number
          const productsWithImages = data.data.map((product: Product) => ({
            ...product,
            price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
            rating: typeof product.rating === 'string' ? parseFloat(product.rating) : (product.rating || 0),
            review_count: typeof product.review_count === 'string' ? parseInt(String(product.review_count)) : (product.review_count || 0),
            image: imageMap[product.image] || product.image,
            background: product.background ? (backgroundMap[product.background] || product.background) : undefined,
          }));
          setResults(productsWithImages);
        } else {
          setResults([]);
        }
      } catch (err) {
        // Ignore abort errors
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('Error searching products:', err);
        setError(err instanceof Error ? err.message : 'Search failed');
        setResults([]);
      } finally {
        setLoading(false);
      }
    };

    performSearch();

    // Cleanup: abort request on unmount or query change
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [debouncedQuery, filters, isFiltering]);

  // Update a single filter
  const updateFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  }, []);

  // Clear only search query
  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setDebouncedQuery('');
  }, []);

  // Clear only filters
  const clearFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  // Clear both search and filters
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
    loading,
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
  };
};
