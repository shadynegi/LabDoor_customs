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
  size?: string;
  color?: string;
  stock?: number;
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
    size: 'US 9',
    color: 'Blue',
    stock: TEST_PRODUCTS.nikeBlue.stock,
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
    size: 'US 10',
    color: 'Gold',
    stock: TEST_PRODUCTS.goldenEssence.stock,
    is_out_of_stock: TEST_PRODUCTS.goldenEssence.is_out_of_stock,
    created_at: '2024-05-15T00:00:00.000Z',
  },
];

export const MOCK_FILTERS = {
  sizes: ['US 9', 'US 10'],
  priceRange: { min: 98, max: 98 },
  sortOptions: [
    { value: 'default', label: 'Default' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'newest', label: 'Newest First' },
    { value: 'oldest', label: 'Oldest First' },
  ],
};

/** Primary in-stock catalog product for UI tests. */
export const PRIMARY_MOCK_PRODUCT = MOCK_PRODUCTS[0];
