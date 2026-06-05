import { describe, expect, it } from 'vitest';
import {
  validateProductImageUrl,
  validateOptionalProductImageUrl,
} from '../../backend/src/lib/productImage';

describe('productImage validation', () => {
  it('accepts https URLs', () => {
    const result = validateProductImageUrl('https://cdn.example.com/shoe.jpg', 'Image');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toContain('https://');
  });

  it('rejects oversized data URLs', () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(700_000);
    const result = validateProductImageUrl(huge, 'Image');
    expect(result.ok).toBe(false);
  });

  it('allows empty optional background', () => {
    const result = validateOptionalProductImageUrl('', 'Background');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });
});
