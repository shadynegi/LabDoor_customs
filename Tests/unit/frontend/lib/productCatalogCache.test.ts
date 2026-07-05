import { describe, expect, it, vi } from 'vitest';
import {
  CATALOG_CLEARED_EVENT,
  clearProductCatalogCache,
  normalizeProduct,
} from '../../../../frontend/src/lib/productCatalogCache';

describe('productCatalogCache', () => {
  it('normalizes string prices to numbers', () => {
    expect(
      normalizeProduct({
        id: 1,
        name: 'Test Shoe',
        price: '49.99',
        image: '/img.png',
      }),
    ).toEqual({
      id: 1,
      name: 'Test Shoe',
      price: 49.99,
      image: '/img.png',
    });
  });

  it('clears legacy catalog storage and dispatches refresh event', () => {
    const removeItem = vi.spyOn(Storage.prototype, 'removeItem');
    const handler = vi.fn();
    window.addEventListener(CATALOG_CLEARED_EVENT, handler);

    clearProductCatalogCache();

    expect(removeItem).toHaveBeenCalledWith('ldc_product_catalog_v1');
    expect(handler).toHaveBeenCalledTimes(1);

    window.removeEventListener(CATALOG_CLEARED_EVENT, handler);
    removeItem.mockRestore();
  });
});
