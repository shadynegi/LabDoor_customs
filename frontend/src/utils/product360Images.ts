// product360Images.ts - Utility for 360° product image management

import { logWarn } from '../lib/logger';

// Standard angles for 360° product photography
export const STANDARD_ANGLES = [
  'front',
  'angle-front-right',
  'right',
  'angle-back-right',
  'back',
  'angle-back-left',
  'left',
  'angle-front-left',
] as const;

export type ProductAngle = typeof STANDARD_ANGLES[number];

// Product folder name mapping
export const PRODUCT_FOLDERS: Record<string, string> = {
  'nike-drops': 'Nike_Drops',
  'golden-essence': 'Golden_ESSENCE',
  'pink-panda': 'Pink_Panda',
  'browny-classic': 'Browny_CLASSIC',
  'lab-door-sport': 'LAB_DOOR_SPORT',
};

// Video file mapping
export const PRODUCT_VIDEOS: Record<string, string> = {
  'nike-drops': '/assets/Videos/360_Spins/nike-drops-360.mp4',
  'golden-essence': '/assets/Videos/360_Spins/golden-essence-360.mp4',
  'pink-panda': '/assets/Videos/360_Spins/pink-panda-360.mp4',
  'browny-classic': '/assets/Videos/360_Spins/browny-classic-360.mp4',
  'lab-door-sport': '/assets/Videos/360_Spins/lab-door-sport-360.mp4',
};

/**
 * Generate array of image paths for 360° viewer
 * @param productSlug - Product identifier (e.g., 'nike-drops')
 * @param angles - Array of angle names to include
 * @returns Array of image URLs
 */
export const get360ImagePaths = (
  productSlug: string,
  angles: readonly string[] = STANDARD_ANGLES
): string[] => {
  const folder = PRODUCT_FOLDERS[productSlug];
  if (!folder) {
    logWarn(`No folder mapping found for product: ${productSlug}`);
    return [];
  }

  return angles.map(angle => `/assets/Products/${folder}/${angle}.png`);
};

/**
 * Get 360° video path for a product
 * @param productSlug - Product identifier
 * @returns Video URL or undefined
 */
export const get360VideoPath = (productSlug: string): string | undefined => {
  return PRODUCT_VIDEOS[productSlug];
};

/**
 * Check if 360° assets exist for a product
 * This is a helper that can be used to conditionally show 360° viewer
 */
export const has360Assets = async (productSlug: string): Promise<boolean> => {
  const images = get360ImagePaths(productSlug);
  if (images.length === 0) return false;

  try {
    // Check if first image exists
    const response = await fetch(images[0], { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
};

/**
 * Generate placeholder images for development/demo
 * Uses the same image rotated programmatically
 */
export const generatePlaceholder360Images = (
  baseImageUrl: string,
  frameCount: number = 8
): string[] => {
  // For now, return the same image repeated
  // In production, these would be actual multi-angle photos
  return Array(frameCount).fill(baseImageUrl);
};

/**
 * Product 360° configuration type
 */
export interface Product360Config {
  productSlug: string;
  productName: string;
  images: string[];
  videoUrl?: string;
  fallbackImage: string;
}

/**
 * Get complete 360° configuration for a product
 */
export const getProduct360Config = (
  productSlug: string,
  productName: string,
  fallbackImage: string
): Product360Config => {
  const images = get360ImagePaths(productSlug);
  const videoUrl = get360VideoPath(productSlug);

  return {
    productSlug,
    productName,
    images: images.length > 0 ? images : generatePlaceholder360Images(fallbackImage),
    videoUrl,
    fallbackImage,
  };
};

export default {
  STANDARD_ANGLES,
  PRODUCT_FOLDERS,
  PRODUCT_VIDEOS,
  get360ImagePaths,
  get360VideoPath,
  has360Assets,
  generatePlaceholder360Images,
  getProduct360Config,
};
