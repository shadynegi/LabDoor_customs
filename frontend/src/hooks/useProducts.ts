// Custom hook for fetching and managing products
import { useState, useEffect } from 'react';
import { catalogFetch } from '../config';
import { toast } from 'sonner';
import { logError } from '../lib/logger';
import { normalizeProduct, CATALOG_CLEARED_EVENT } from '../lib/productCatalogCache';

export interface Product {
  id: number;
  public_id?: string;
  name: string;
  price: number;
  image: string;
  description?: string;
  background?: string;
  created_at?: string;
  stock?: number;
  view_count?: number;
  cart_count?: number;
  is_out_of_stock?: boolean;
  video_360?: string | null;
}

interface UseProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

/**
 * Hook to fetch products from the backend API
 * Falls back to hardcoded products if API fails (development mode)
 */
export const useProducts = (): UseProductsResult => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await catalogFetch('/products', {
        retry: { count: 2, on: [502, 503, 504] },
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();

      if (data.success && data.data) {
        const productsWithImages = data.data.map((product: Product) => normalizeProduct(product));
        setProducts(productsWithImages);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      logError('Error fetching products:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load products';
      setError(errorMsg);
      
      toast.error('Failed to load products', {
        description: 'Unable to retrieve products from the database. Please refresh the page or try again later.',
        duration: 6000,
      });
      
      // Fallback to empty array in production, or show error
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const onCatalogCleared = () => {
      void fetchProducts();
    };
    window.addEventListener(CATALOG_CLEARED_EVENT, onCatalogCleared);
    return () => window.removeEventListener(CATALOG_CLEARED_EVENT, onCatalogCleared);
  }, []);

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
  };
};

