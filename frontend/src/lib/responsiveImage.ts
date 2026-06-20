import type { ResponsiveImageSet } from './generatedImageAssets';
import { getProductImageSrcSet, getShoeImageSet } from './productImageMaps';
import { optimizeImageUrl, type OptimizeImageOptions } from '../utils/imageUrl';

export const PRODUCT_IMAGE_SIZES = {
  hero: '(max-width: 640px) 85vw, 560px',
  grid: '(max-width: 640px) 45vw, 240px',
  thumb: '80px',
  cart: '90px',
  checkout: '80px',
  detail: '(max-width: 640px) 85vw, 480px',
} as const;

export interface ResponsiveImgProps {
  src: string;
  srcSet?: string;
  sizes?: string;
  alt: string;
  loading?: 'eager' | 'lazy';
  fetchPriority?: 'high' | 'low' | 'auto';
  decoding?: 'async' | 'sync' | 'auto';
  width?: number;
  height?: number;
}

export function buildResponsiveProductImg(
  imageUrl: string,
  options: {
    alt: string;
    sizes: string;
    loading?: 'eager' | 'lazy';
    fetchPriority?: 'high' | 'low' | 'auto';
    width?: number;
    height?: number;
    optimize?: OptimizeImageOptions;
  }
): ResponsiveImgProps {
  const bundledSrcSet = getProductImageSrcSet(imageUrl);
  const bundledSet = getShoeImageSet(imageUrl);

  if (bundledSet && bundledSrcSet) {
    return {
      src: bundledSet.default,
      srcSet: bundledSrcSet,
      sizes: options.sizes,
      alt: options.alt,
      loading: options.loading ?? 'lazy',
      decoding: 'async',
      width: options.width,
      height: options.height,
      ...(options.fetchPriority ? { fetchPriority: options.fetchPriority } : {}),
    };
  }

  const width = options.optimize?.width ?? 640;
  return {
    src: optimizeImageUrl(imageUrl, { width, ...options.optimize }),
    alt: options.alt,
    loading: options.loading ?? 'lazy',
    decoding: 'async',
    width: options.width,
    height: options.height,
    ...(options.fetchPriority ? { fetchPriority: options.fetchPriority } : {}),
  };
}

export function backgroundUrlFromSet(set: ResponsiveImageSet, viewportWidth: number): string {
  if (viewportWidth <= 1280 && set.widths.includes(1280)) {
    const idx = set.widths.indexOf(1280);
    return set.srcSet.split(', ')[idx]?.split(' ')[0] ?? set.default;
  }
  return set.default;
}
