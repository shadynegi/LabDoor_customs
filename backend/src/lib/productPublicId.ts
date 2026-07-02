const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isProductPublicId(value: string): boolean {
  return UUID_REGEX.test(value.trim());
}

export function isNumericProductId(value: string): boolean {
  return /^\d+$/.test(value.trim());
}
