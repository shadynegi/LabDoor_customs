import {
  TEST_PRODUCTS,
  cartLine,
  type ProductDbRow,
} from '../../fixtures/products';

const DEFAULT_CHECKOUT_PRODUCT = TEST_PRODUCTS.checkoutShoe;

/** Shared place-order body for API integration tests. */
export function placeOrderPayload(overrides: Record<string, unknown> = {}) {
  return {
    amount: '125.00',
    policy_accepted: true,
    customerInfo: {
      fullName: 'Jane Buyer',
      email: 'jane@example.com',
      phone: '+919876543210',
      address: '456 Oak Ave',
      city: 'Mumbai',
      state: 'MH',
      zipCode: '400001',
      country: 'India',
    },
    items: [cartLine(DEFAULT_CHECKOUT_PRODUCT)],
    ...overrides,
  };
}

export function placeOrderPayloadForProduct(
  product: ProductDbRow,
  overrides: Record<string, unknown> = {},
) {
  return placeOrderPayload({
    items: [cartLine(product)],
    ...overrides,
  });
}

export { DEFAULT_CHECKOUT_PRODUCT };
