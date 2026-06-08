import { catalogFetch } from '../config';
import type { Product } from '../hooks/useProducts';
import blueNikeImg from '../assets/Shoe_Design/blue nike.png';
import goldBlackNikeImg from '../assets/Shoe_Design/gold black nike.png';
import pinkNikeImg from '../assets/Shoe_Design/pink nike.png';
import blackBrownNikeImg from '../assets/Shoe_Design/black and brown nike.png';
import brownPinkNikeImg from '../assets/Shoe_Design/brown pink nike.png';
import blueBg from '../assets/Backgrounds/blue.png';
import goldBg from '../assets/Backgrounds/gold.png';
import pinkBg from '../assets/Backgrounds/pink.png';
import brownBg from '../assets/Backgrounds/brown.png';
import brownPinkBg from '../assets/Backgrounds/brown pink.png';

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

const CACHE_KEY = 'ldc_product_catalog_v1';
const CACHE_TTL_MS = 15 * 60 * 1000;

interface CachedCatalog {
  fetchedAt: number;
  products: Product[];
}

export function normalizeProduct(product: Product): Product {
  return {
    ...product,
    price: typeof product.price === 'string' ? parseFloat(product.price) : product.price,
    rating: typeof product.rating === 'string'
      ? parseFloat(product.rating)
      : (product.rating || 0),
    review_count: typeof product.review_count === 'string'
      ? parseInt(String(product.review_count), 10)
      : (product.review_count || 0),
    image: imageMap[product.image] || product.image,
    background: product.background
      ? (backgroundMap[product.background] || product.background)
      : undefined,
  };
}

function readCache(): CachedCatalog | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCatalog;
    if (!parsed?.products || !parsed.fetchedAt) return null;
    if (Date.now() - parsed.fetchedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(products: Product[]) {
  try {
    const payload: CachedCatalog = {
      fetchedAt: Date.now(),
      products,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    // Ignore quota / private mode errors
  }
}

async function fetchCatalogFromApi(): Promise<Product[]> {
  const limit = 100;
  let page = 1;
  const allProducts: Product[] = [];

  while (true) {
    const response = await catalogFetch(`/products?limit=${limit}&page=${page}`, {
      retry: { count: 2, on: [502, 503, 504] },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch product catalog');
    }

    const data = await response.json();
    if (!data.success || !Array.isArray(data.data)) {
      throw new Error('Invalid product catalog response');
    }

    const batch = data.data.map((product: Product) => normalizeProduct(product));
    allProducts.push(...batch);

    const hasMore = data.pagination?.hasMore ?? batch.length === limit;
    if (!hasMore || batch.length < limit) break;
    page += 1;
  }

  return allProducts;
}

/** Fetch all products once; reuse localStorage cache for 15 minutes. */
export async function getProductCatalog(forceRefresh = false): Promise<Product[]> {
  if (!forceRefresh) {
    const cached = readCache();
    if (cached) return cached.products;
  }

  const products = await fetchCatalogFromApi();
  writeCache(products);
  return products;
}

export const CATALOG_CLEARED_EVENT = 'ldc:catalog-cleared';

export function clearProductCatalogCache() {
  localStorage.removeItem(CACHE_KEY);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CATALOG_CLEARED_EVENT));
  }
}
