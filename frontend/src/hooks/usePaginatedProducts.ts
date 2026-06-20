// Custom hook for fetching paginated products
import { useState, useEffect, useCallback } from 'react';
import { catalogFetch } from '../config';
import type { Product } from './useProducts';
import { toast } from 'sonner';
import { logError } from '../lib/logger';

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

interface UsePaginatedProductsResult {
  products: Product[];
  loading: boolean;
  error: string | null;
  pagination: PaginationInfo | null;
  loadMore: () => void;
  hasMore: boolean;
  refetch: () => void;
}

/**
 * Hook to fetch paginated products from the backend API
 * Supports infinite scroll by accumulating products
 */
export const usePaginatedProducts = (limit: number = 10): UsePaginatedProductsResult => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchProducts = useCallback(async (page: number, append: boolean = false) => {
    try {
      setLoading(true);
      setError(null);

      const response = await catalogFetch(`/products?page=${page}&limit=${limit}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Map database image paths to actual imported images and convert price to number
        const productsWithImages = data.data.map((product: Product) => ({
          ...product,
          price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
          rating: typeof product.rating === 'string' ? parseFloat(product.rating) : (product.rating || 0),
          review_count: typeof product.review_count === 'string' ? parseInt(product.review_count) : (product.review_count || 0),
        }));
        
        if (append) {
          setProducts(prev => [...prev, ...productsWithImages]);
        } else {
          setProducts(productsWithImages);
        }
        
        setPagination(data.pagination);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      logError('Error fetching products:', err);
      const errorMsg = err instanceof Error ? err.message : 'Failed to load products';
      setError(errorMsg);
      
      if (page === 1) {
        toast.error('Failed to load products', {
          description: 'Unable to retrieve products from the database. Please refresh the page or try again later.',
          duration: 6000,
        });
      }
    } finally {
      setLoading(false);
    }
  }, [limit]);

  const loadMore = useCallback(() => {
    if (pagination && pagination.hasMore && !loading) {
      const nextPage = currentPage + 1;
      setCurrentPage(nextPage);
      fetchProducts(nextPage, true);
    }
  }, [pagination, loading, currentPage, fetchProducts]);

  const refetch = useCallback(() => {
    setCurrentPage(1);
    fetchProducts(1, false);
  }, [fetchProducts]);

  useEffect(() => {
    fetchProducts(1, false);
  }, [fetchProducts]);

  return {
    products,
    loading,
    error,
    pagination,
    loadMore,
    hasMore: pagination?.hasMore ?? false,
    refetch,
  };
};

