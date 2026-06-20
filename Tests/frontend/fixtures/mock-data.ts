/** Stable product fixtures for Playwright API mocks (image paths match frontend imageMap keys). */

export interface MockProduct {
  id: number;
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

export const MOCK_PRODUCTS: MockProduct[] = [
  {
    id: 1,
    name: 'Nike Drops - Blue',
    price: 98,
    image: '/assets/blue-nike.png',
    background: '/assets/blue-bg.png',
    description: 'Custom blue athletic drops for everyday wear.',
    category: 'Athletic',
    size: 'US 9',
    color: 'Blue',
    stock: 10,
    rating: 4.5,
    review_count: 12,
    is_out_of_stock: false,
    created_at: '2024-06-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Golden ESSENCE',
    price: 98,
    image: '/assets/gold-black-nike.png',
    background: '/assets/gold-bg.png',
    description: 'Premium gold and black custom design.',
    category: 'Lifestyle',
    size: 'US 10',
    color: 'Gold',
    stock: 0,
    rating: 4.8,
    review_count: 8,
    is_out_of_stock: true,
    created_at: '2024-05-15T00:00:00.000Z',
  },
];

export const MOCK_FILTERS = {
  categories: ['Athletic', 'Lifestyle'],
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
  id: 1,
  product_id: 1,
  rating: 5,
  title: 'Great quality',
  review_text: 'Love the custom work.',
  customer_name: 'Alex',
  is_verified_purchase: true,
  is_recommended: true,
  helpful_count: 2,
  created_at: '2024-07-01T00:00:00.000Z',
};
