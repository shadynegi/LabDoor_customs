/** Stable product fixtures for Playwright API mocks (image paths match frontend imageMap keys). */

import { TEST_PRODUCT_IDS, TEST_PRODUCTS, TEST_PRODUCT_PUBLIC_IDS } from '../../fixtures/products';

export interface MockProduct {
  id: number;
  public_id?: string;
  name: string;
  price: number;
  image: string;
  background?: string;
  description?: string;
  category?: string;
  size?: string;
  color?: string;
  stock?: number;
  rating?: number;
  review_count?: number;
  is_out_of_stock?: boolean;
  created_at?: string;
}

export { TEST_PRODUCT_IDS };

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: TEST_PRODUCTS.nikeBlue.id,
    public_id: TEST_PRODUCT_PUBLIC_IDS.nikeBlue,
    name: TEST_PRODUCTS.nikeBlue.name,
    price: TEST_PRODUCTS.nikeBlue.price as number,
    image: TEST_PRODUCTS.nikeBlue.image,
    background: '/assets/blue-bg.png',
    description: 'Custom blue athletic drops for everyday wear.',
    category: 'Athletic',
    size: 'US 9',
    color: 'Blue',
    stock: TEST_PRODUCTS.nikeBlue.stock,
    rating: 4.5,
    review_count: 12,
    is_out_of_stock: TEST_PRODUCTS.nikeBlue.is_out_of_stock,
    created_at: '2024-06-01T00:00:00.000Z',
  },
  {
    id: TEST_PRODUCTS.goldenEssence.id,
    public_id: TEST_PRODUCT_PUBLIC_IDS.goldenEssence,
    name: TEST_PRODUCTS.goldenEssence.name,
    price: TEST_PRODUCTS.goldenEssence.price as number,
    image: TEST_PRODUCTS.goldenEssence.image,
    background: '/assets/gold-bg.png',
    description: 'Premium gold and black custom design.',
    category: 'Lifestyle',
    size: 'US 10',
    color: 'Gold',
    stock: TEST_PRODUCTS.goldenEssence.stock,
    rating: 4.8,
    review_count: 8,
    is_out_of_stock: TEST_PRODUCTS.goldenEssence.is_out_of_stock,
    created_at: '2024-05-15T00:00:00.000Z',
  },
];

export const MOCK_FILTERS = {
  sizes: ['US 9', 'US 10'],
  priceRange: { min: 98, max: 98 },
  ratingRange: { min: 4.5, max: 4.8, avg: 4.65 },
  sortOptions: [
    { value: 'default', label: 'Default' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'rating_desc', label: 'Highest Rated' },
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
  ],
};

export const MOCK_REVIEWS_STATS = {
  total_reviews: 1,
  average_rating: '5.00',
  five_star: 1,
  four_star: 0,
  three_star: 0,
  two_star: 0,
  one_star: 0,
  verified_purchases: 1,
  recommended: 1,
};

export const MOCK_PUBLIC_REVIEW = {
  id: 9001,
  product_id: TEST_PRODUCT_IDS.nikeBlue,
  rating: 5,
  title: 'Great quality',
  review_text: 'Love the custom work.',
  customer_name: 'Alex',
  is_verified_purchase: true,
  is_recommended: true,
  helpful_count: 2,
  created_at: '2024-07-01T00:00:00.000Z',
};

/** Primary in-stock catalog product for UI tests. */
export const PRIMARY_MOCK_PRODUCT = MOCK_PRODUCTS[0];
