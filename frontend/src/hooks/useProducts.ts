// Custom hook for fetching and managing products
import { useState, useEffect } from 'react';
import { apiFetch } from '../config';
import { toast } from 'sonner';

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

export interface Product {
  id: number;
  name: string;
  price: number;
  image: string;
  description?: string;
  background?: string;
  category?: string;
  stock?: number;
  rating?: number;
  review_count?: number;
  view_count?: number;
  cart_count?: number;
  is_out_of_stock?: boolean;
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

      const response = await apiFetch('/products');
      
      if (!response.ok) {
        throw new Error('Failed to fetch products');
      }

      const data = await response.json();

      if (data.success && data.data) {
        // Map database image paths to actual imported images and convert price to number
        const productsWithImages = data.data.map((product: Product) => ({
          ...product,
          price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
          image: imageMap[product.image] || product.image,
          background: product.background ? (backgroundMap[product.background] || product.background) : undefined,
        }));
        setProducts(productsWithImages);
      } else {
        throw new Error('Invalid response format');
      }
    } catch (err) {
      console.error('Error fetching products:', err);
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

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
  };
};

