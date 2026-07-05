/** Whole-number shoe sizes only (no half sizes). */
export const SHOE_SIZE_OPTIONS = {
  UK: ['5', '6', '7', '8', '9', '10', '11', '12'],
  US: ['6', '7', '8', '9', '10', '11', '12', '13'],
  EU: ['38', '39', '40', '41', '42', '43', '44', '45', '46', '47', '48'],
} as const;

export type ShoeSizeSystem = keyof typeof SHOE_SIZE_OPTIONS;
