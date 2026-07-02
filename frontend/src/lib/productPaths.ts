/** Storefront path for a product detail page (uses stable public UUID when available). */
export function getProductDetailPath(product: {
  public_id?: string | null;
  id: number;
}): string {
  if (product.public_id) {
    return `/product/${product.public_id}`;
  }
  return `/product/${product.id}`;
}
