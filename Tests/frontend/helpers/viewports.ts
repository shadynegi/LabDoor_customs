/**
 * Popular phone viewports for responsive Playwright checks.
 * CSS viewport sizes (logical px) — aligned with Playwright device presets where available.
 * iPhone 17 / Galaxy S25 use expected logical resolutions (same class as recent flagships).
 */

export type MobileViewportProfile = {
  id: string;
  label: string;
  viewport: { width: number; height: number };
};

/** Narrowest common phones through large Android flagships. */
export const POPULAR_MOBILE_VIEWPORTS: MobileViewportProfile[] = [
  { id: 'iphone-se-3', label: 'iPhone SE (3rd gen)', viewport: { width: 375, height: 667 } },
  { id: 'iphone-15-pro', label: 'iPhone 15 Pro', viewport: { width: 393, height: 659 } },
  { id: 'iphone-17', label: 'iPhone 17', viewport: { width: 393, height: 852 } },
  { id: 'iphone-17-pro', label: 'iPhone 17 Pro', viewport: { width: 402, height: 874 } },
  { id: 'iphone-17-pro-max', label: 'iPhone 17 Pro Max', viewport: { width: 430, height: 932 } },
  { id: 'galaxy-s24', label: 'Samsung Galaxy S24', viewport: { width: 360, height: 780 } },
  { id: 'galaxy-s25', label: 'Samsung Galaxy S25', viewport: { width: 360, height: 780 } },
  { id: 'galaxy-s25-ultra', label: 'Samsung Galaxy S25 Ultra', viewport: { width: 412, height: 915 } },
  { id: 'pixel-9-pro', label: 'Google Pixel 9 Pro', viewport: { width: 412, height: 915 } },
  { id: 'galaxy-a55', label: 'Samsung Galaxy A55', viewport: { width: 480, height: 1040 } },
];

export type StorefrontPageSpec = {
  path: string;
  /** Accessible name for getByRole('heading', { name }) */
  heading?: string | RegExp;
  /** Fallback when the page has no primary heading (e.g. home hero) */
  readyText?: string | RegExp;
  scrollReady?: boolean;
};

export const STOREFRONT_STATIC_PAGES: StorefrontPageSpec[] = [
  { path: '/', readyText: 'View All Products', scrollReady: true },
  { path: '/products', heading: 'All Products' },
  { path: '/about', heading: 'About Lab Door Customs' },
  { path: '/contact', heading: 'Contact Us' },
  { path: '/help', heading: 'Help Center' },
  { path: '/privacy-policy', heading: 'Privacy Policy' },
  { path: '/terms-of-service', heading: 'Terms of Service' },
  { path: '/replacement-policy', heading: 'Replacement Policy' },
  { path: '/shipping-policy', heading: 'Shipping Policy' },
  { path: '/orders', heading: 'Track Your Orders' },
  { path: '/admin/login', heading: 'Admin Portal' },
  { path: '/payment/success', heading: 'Order received' },
  { path: '/payment/cancel', heading: 'Payment Cancelled' },
];
