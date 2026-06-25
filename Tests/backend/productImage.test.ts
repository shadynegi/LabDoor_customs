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

  it('accepts data URLs longer than 2048 chars when under 1MB', () => {
    const base64 = 'A'.repeat(10_000);
    const dataUrl = `data:image/png;base64,${base64}`;
    expect(dataUrl.length).toBeGreaterThan(2048);
    const result = validateProductImageUrl(dataUrl, 'Product image');
    expect(result.ok).toBe(true);
  });

  it('rejects oversized data URLs', () => {
    const huge = 'data:image/png;base64,' + 'A'.repeat(1_500_000);
    const result = validateProductImageUrl(huge, 'Image');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('1MB');
    }
  });

  it('rejects http URLs longer than 2048 chars', () => {
    const long = 'https://cdn.example.com/' + 'a'.repeat(2048);
    const result = validateProductImageUrl(long, 'Product image');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('too long');
    }
  });

  it('allows empty optional background', () => {
    const result = validateOptionalProductImageUrl('', 'Background');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeNull();
  });
});
