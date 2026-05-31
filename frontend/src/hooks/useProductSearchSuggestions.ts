import { useState, useEffect, useMemo, useRef } from 'react';
import type { Product } from './useProducts';
import { getProductCatalog } from '../lib/productCatalogCache';
import { createProductFuse, fuseSearchProducts, SUGGESTION_LIMIT } from '../lib/productFuseSearch';

export interface UseProductSearchSuggestionsResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  suggestions: Product[];
  loading: boolean;
  clearSearch: () => void;
}

/** Lightweight Fuse.js suggestions hook (catalog cache + dropdown). */
export function useProductSearchSuggestions(): UseProductSearchSuggestionsResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [catalog, setCatalog] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const fuseRef = useRef<ReturnType<typeof createProductFuse> | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadCatalog = async () => {
      try {
        setLoading(true);
        const products = await getProductCatalog();
        if (!cancelled) {
          setCatalog(products);
          fuseRef.current = createProductFuse(products);
        }
      } catch {
        if (!cancelled) {
          setCatalog([]);
          fuseRef.current = null;
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadCatalog();
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(() => {
    if (!searchQuery.trim() || !fuseRef.current) return [];
    return fuseSearchProducts(fuseRef.current, searchQuery, SUGGESTION_LIMIT);
  }, [searchQuery, catalog]);

  const clearSearch = () => setSearchQuery('');

  return {
    searchQuery,
    setSearchQuery,
    suggestions,
    loading,
    clearSearch,
  };
}
