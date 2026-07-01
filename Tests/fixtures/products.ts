import type { Mock } from 'vitest';

/** Row shape returned by `SELECT ... FROM products WHERE id = ?`. */
export interface ProductDbRow {
  id: number;
  name: string;
  price: number | string;
  image: string;
  stock: number;
  is_out_of_stock: boolean;
}

type SqlMockFn = Mock<
  (strings: TemplateStringsArray, ...values: unknown[]) => Promise<unknown[]>
>;

/** Stable SERIAL-style IDs (avoid magic `1` / `2` in tests). */
export const TEST_PRODUCT_IDS = {
  nikeBlue: 10042,
  goldenEssence: 10087,
  soldOutShoe: 10091,
  checkoutShoe: 10104,
} as const;

/** Catalog rows — IDs match what a real Postgres `products` table would return. */
export const TEST_PRODUCTS = {
  nikeBlue: {
    id: TEST_PRODUCT_IDS.nikeBlue,
    name: 'Nike Drops - Blue',
    price: 98,
    image: '/assets/blue-nike.png',
    stock: 10,
    is_out_of_stock: false,
  },
  goldenEssence: {
    id: TEST_PRODUCT_IDS.goldenEssence,
    name: 'Golden ESSENCE',
    price: 98,
    image: '/assets/gold-black-nike.png',
    stock: 0,
    is_out_of_stock: true,
  },
  soldOutShoe: {
    id: TEST_PRODUCT_IDS.soldOutShoe,
    name: 'Sold Out Shoe',
    price: 98,
    image: '/assets/test.png',
    stock: 0,
    is_out_of_stock: true,
  },
  checkoutShoe: {
    id: TEST_PRODUCT_IDS.checkoutShoe,
    name: 'Test Shoe',
    price: 100,
    image: '/assets/test.png',
    stock: 10,
    is_out_of_stock: false,
  },
} as const satisfies Record<string, ProductDbRow>;

function isProductByIdQuery(strings: TemplateStringsArray): boolean {
  const query = strings.join(' ');
  return query.includes('FROM products') && query.includes('WHERE id');
}

/** Mock one product lookup (as `validateCartItems` does) and return the DB id. */
export function mockProductDbLookup(sqlMock: SqlMockFn, product: ProductDbRow): number {
  sqlMock.mockResolvedValueOnce([{ ...product }]);
  return product.id;
}

/** Resolve cart line using the product id stored on the catalog row. */
export function cartLine(product: Pick<ProductDbRow, 'id'>, quantity = 1) {
  return { product_id: product.id, quantity };
}

/**
 * Route `FROM products WHERE id = ?` queries through the in-memory catalog.
 * Other SQL calls return `[]` unless queued with `mockResolvedValueOnce`.
 */
export function installProductCatalogMock(
  sqlMock: SqlMockFn,
  catalog: ProductDbRow[] = Object.values(TEST_PRODUCTS)
): void {
  const byId = new Map(catalog.map((row) => [row.id, row]));

  sqlMock.mockImplementation(async (strings, ...values) => {
    if (isProductByIdQuery(strings)) {
      const id = values[0] as number;
      const row = byId.get(id);
      return row ? [{ ...row }] : [];
    }
    return [];
  });
}
