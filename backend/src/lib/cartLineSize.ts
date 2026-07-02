export const CART_SIZE_SYSTEMS = ['UK', 'US', 'EU'] as const;
export type CartSizeSystem = (typeof CART_SIZE_SYSTEMS)[number];

/** Whole-number sizes only — no half sizes. */
export const SHOE_SIZE_VALUES: Record<CartSizeSystem, readonly string[]> = {
  UK: ['5', '6', '7', '8', '9', '10', '11', '12'],
  US: ['6', '7', '8', '9', '10', '11', '12', '13'],
  EU: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
};

export function normalizeCartSizeSystem(raw: unknown): CartSizeSystem | null {
  if (typeof raw !== 'string') return null;
  const upper = raw.trim().toUpperCase();
  return (CART_SIZE_SYSTEMS as readonly string[]).includes(upper)
    ? (upper as CartSizeSystem)
    : null;
}

export function normalizeCartSizeValue(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return trimmed;
}

export function isAllowedShoeSizeValue(system: CartSizeSystem, value: string): boolean {
  return (SHOE_SIZE_VALUES[system] as readonly string[]).includes(value);
}

export function validateCartLineSize(
  size_system: unknown,
  size_value: unknown,
): { ok: true; size_system: CartSizeSystem; size_value: string } | { ok: false; error: string; message: string } {
  const system = normalizeCartSizeSystem(size_system);
  const value = normalizeCartSizeValue(size_value);

  if (!system || !value || !isAllowedShoeSizeValue(system, value)) {
    return {
      ok: false,
      error: 'Size required',
      message: 'Please select a size (system and value) for each cart item',
    };
  }

  return { ok: true, size_system: system, size_value: value };
}
