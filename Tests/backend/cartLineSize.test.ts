import { describe, it, expect } from 'vitest';
import { validateCartLineSize } from '../../backend/src/lib/cartLineSize';

describe('validateCartLineSize', () => {
  it('accepts UK, US, and EU size systems with numeric values', () => {
    expect(validateCartLineSize('US', '10')).toEqual({
      ok: true,
      size_system: 'US',
      size_value: '10',
    });
    expect(validateCartLineSize('EU', '42')).toEqual({
      ok: true,
      size_system: 'EU',
      size_value: '42',
    });
  });

  it('rejects half sizes and values outside the allowed list', () => {
    expect(validateCartLineSize('uk', '10.5').ok).toBe(false);
    expect(validateCartLineSize('US', '14').ok).toBe(false);
  });

  it('rejects missing or invalid size', () => {
    expect(validateCartLineSize(undefined, '10').ok).toBe(false);
    expect(validateCartLineSize('US', '').ok).toBe(false);
    expect(validateCartLineSize('JP', '10').ok).toBe(false);
    expect(validateCartLineSize('US', 'large').ok).toBe(false);
  });
});
