import type { Page } from '@playwright/test';

const COOKIE_CONSENT_KEY = 'lab_door_cookie_consent';
const COOKIE_PREFERENCES_KEY = 'lab_door_cookie_preferences';
const CART_STORAGE_KEY = 'labdoor_cart';

export interface SeedCartItem {
  id: number;
  name: string;
  price: number;
  image: string;
  quantity: number;
  size?: { system: 'UK' | 'US' | 'EU'; value: string };
}

const DEFAULT_SEED_CART_SIZE = { system: 'US' as const, value: '10' };

/** Pre-accept cookies so the banner does not block interactions. */
export async function preAcceptCookies(page: Page): Promise<void> {
  await page.addInitScript(
    ({ consentKey, prefsKey }) => {
      localStorage.setItem(consentKey, 'true');
      localStorage.setItem(
        prefsKey,
        JSON.stringify({ essential: true, analytics: true, marketing: false }),
      );
    },
    { consentKey: COOKIE_CONSENT_KEY, prefsKey: COOKIE_PREFERENCES_KEY },
  );
}

/** Clear stored consent so the cookie banner can appear (wait up to 1.5s for delayed show). */
export async function clearCookieConsent(page: Page): Promise<void> {
  await page.addInitScript(
    ({ consentKey, prefsKey }) => {
      localStorage.removeItem(consentKey);
      localStorage.removeItem(prefsKey);
    },
    { consentKey: COOKIE_CONSENT_KEY, prefsKey: COOKIE_PREFERENCES_KEY },
  );
}

export async function acceptAllCookies(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: 'Accept All' });
  await accept.waitFor({ state: 'visible', timeout: 5000 });
  await accept.click();
  await accept.waitFor({ state: 'hidden', timeout: 5000 });
}

export async function seedCart(page: Page, items: SeedCartItem[]): Promise<void> {
  const normalized = items.map((item) => ({
    ...item,
    size: item.size ?? DEFAULT_SEED_CART_SIZE,
  }));
  const total = normalized.reduce((sum, item) => sum + item.price * item.quantity, 0);
  await page.addInitScript(
    ({ storageKey, cartState }) => {
      localStorage.setItem(storageKey, JSON.stringify(cartState));
    },
    { storageKey: CART_STORAGE_KEY, cartState: { items: normalized, total } },
  );
}
