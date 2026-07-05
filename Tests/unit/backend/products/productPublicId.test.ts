import { describe, it, expect } from 'vitest';
import { isNumericProductId, isProductPublicId } from '../../../../backend/src/lib/productPublicId';

describe('productPublicId', () => {
  it('detects valid product public UUIDs', () => {
    expect(isProductPublicId('00000000-0000-4000-8000-000000010042')).toBe(true);
    expect(isProductPublicId('not-a-uuid')).toBe(false);
  });

  it('detects numeric legacy product ids', () => {
    expect(isNumericProductId('10042')).toBe(true);
    expect(isNumericProductId('abc')).toBe(false);
  });
});
