import {
  shoeImageSets,
  backgroundImageSets,
  logo_all_pages,
  logo_all_pages_text,
  logo_home_text,
  type ResponsiveImageSet,
} from './generatedImageAssets';

/** DB image path → internal asset id */
const PRODUCT_IMAGE_IDS: Record<string, string> = {
  '/assets/blue-nike.png': 'blue-nike',
  '/assets/gold-black-nike.png': 'gold-black-nike',
  '/assets/pink-nike.png': 'pink-nike',
  '/assets/black-brown-nike.png': 'black-brown-nike',
  '/assets/brown-pink-nike.png': 'brown-pink-nike',
};

/** DB background path → internal asset id */
const PRODUCT_BACKGROUND_IDS: Record<string, string> = {
  '/assets/blue-bg.png': 'blue-bg',
  '/assets/gold-bg.png': 'gold-bg',
  '/assets/pink-bg.png': 'pink-bg',
  '/assets/brown-bg.png': 'brown-bg',
  '/assets/brown-pink-bg.png': 'brown-pink-bg',
};

export { logo_all_pages, logo_all_pages_text, logo_home_text };
export type { ResponsiveImageSet };

export function getShoeImageSet(imageRef: string): ResponsiveImageSet | undefined {
  const id = PRODUCT_IMAGE_IDS[imageRef];
  return id ? shoeImageSets[id] : undefined;
}

export function getBackgroundImageSet(backgroundRef: string): ResponsiveImageSet | undefined {
  const id = PRODUCT_BACKGROUND_IDS[backgroundRef];
  return id ? backgroundImageSets[id] : undefined;
}

/** Maps API image paths to optimized default image URLs. */
export function resolveProductImage(imageRef: string): string {
  return getShoeImageSet(imageRef)?.default ?? imageRef;
}

/** Maps API background paths to optimized default background URLs. */
export function resolveProductBackground(backgroundRef?: string): string | undefined {
  if (!backgroundRef) return undefined;
  return getBackgroundImageSet(backgroundRef)?.default ?? backgroundRef;
}

/** Responsive srcSet for bundled shoe images; undefined for external URLs. */
export function getProductImageSrcSet(imageRef: string): string | undefined {
  return getShoeImageSet(imageRef)?.srcSet;
}

/** Pick background URL for viewport (1280w on mobile-ish, 1920w on desktop). */
export function resolveProductBackgroundForViewport(
  backgroundRef: string | undefined,
  viewportWidth: number
): string | undefined {
  if (!backgroundRef) return undefined;
  const set = getBackgroundImageSet(backgroundRef);
  if (!set) return backgroundRef;
  if (viewportWidth <= 1280 && set.widths.includes(1280)) {
    const idx = set.widths.indexOf(1280);
    return set.srcSet.split(', ')[idx]?.split(' ')[0] ?? set.default;
  }
  return set.default;
}
