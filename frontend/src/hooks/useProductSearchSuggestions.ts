import { useState, useEffect, useRef } from 'react';
import { fetchSearchSuggestions } from '../lib/productSearchApi';
import type { Product } from './useProducts';

export interface UseProductSearchSuggestionsResult {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  suggestions: Product[];
  loading: boolean;
  clearSearch: () => void;
}

/** Server-backed search suggestions for the Home hero search bar. */
export function useProductSearchSuggestions(): UseProductSearchSuggestionsResult {
  const [searchQuery, setSearchQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (!trimmed) {
      setSuggestions([]);
      setLoading(false);
      return;
    }

    const requestId = ++requestRef.current;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const next = await fetchSearchSuggestions(trimmed);
        if (requestId === requestRef.current) {
          setSuggestions(next);
        }
      } catch {
        if (requestId === requestRef.current) {
          setSuggestions([]);
        }
      } finally {
        if (requestId === requestRef.current) {
          setLoading(false);
        }
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const clearSearch = () => {
    setSearchQuery('');
    setSuggestions([]);
  };

  return {
    searchQuery,
    setSearchQuery,
    suggestions,
    loading,
    clearSearch,
  };
}
