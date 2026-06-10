import blueNikeImg from '../assets/Shoe_Design/blue nike.png';
import goldBlackNikeImg from '../assets/Shoe_Design/gold black nike.png';
import pinkNikeImg from '../assets/Shoe_Design/pink nike.png';
import blackBrownNikeImg from '../assets/Shoe_Design/black and brown nike.png';
import brownPinkNikeImg from '../assets/Shoe_Design/brown pink nike.png';
import blueBg from '../assets/Backgrounds/blue.png';
import goldBg from '../assets/Backgrounds/gold.png';
import pinkBg from '../assets/Backgrounds/pink.png';
import brownBg from '../assets/Backgrounds/brown.png';
import brownPinkBg from '../assets/Backgrounds/brown pink.png';

/** Maps API image paths to bundled asset URLs. */
export const productImageMap: Record<string, string> = {
  '/assets/blue-nike.png': blueNikeImg,
  '/assets/gold-black-nike.png': goldBlackNikeImg,
  '/assets/pink-nike.png': pinkNikeImg,
  '/assets/black-brown-nike.png': blackBrownNikeImg,
  '/assets/brown-pink-nike.png': brownPinkNikeImg,
};

/** Maps API background paths to bundled asset URLs. */
export const productBackgroundMap: Record<string, string> = {
  '/assets/blue-bg.png': blueBg,
  '/assets/gold-bg.png': goldBg,
  '/assets/pink-bg.png': pinkBg,
  '/assets/brown-bg.png': brownBg,
  '/assets/brown-pink-bg.png': brownPinkBg,
};

export function resolveProductImage(imageRef: string): string {
  return productImageMap[imageRef] || imageRef;
}

export function resolveProductBackground(backgroundRef?: string): string | undefined {
  if (!backgroundRef) return undefined;
  return productBackgroundMap[backgroundRef] || backgroundRef;
}
