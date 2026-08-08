import { test as base, expect } from '@playwright/test';
import { installStorefrontApiMocks } from '../helpers/mock-api';
import { preAcceptCookies } from '../helpers/ui';
import type { MockProduct } from './mock-data';

type StorefrontFixtures = {
  /** When set, create-payment mock returns this server total (mismatch UI tests). */
  createPaymentTotal: number | undefined;
  /** When set, overrides the catalog the storefront API mock serves. */
  mockProducts: MockProduct[] | undefined;
};

/** Playwright test with API mocks and cookie consent pre-set. */
export const test = base.extend<StorefrontFixtures>({
  createPaymentTotal: [undefined, { option: true }],
  mockProducts: [undefined, { option: true }],
  page: async ({ page, createPaymentTotal, mockProducts }, use) => {
    await installStorefrontApiMocks(page, { createPaymentTotal, products: mockProducts });
    await preAcceptCookies(page);
    // Warm API mocks before checkout cold paths (avoids first-test payment timeout).
    await page.goto('/');
    await page.evaluate(async () => {
      await fetch('/api/csrf-token', { credentials: 'include' });
    });
    await use(page);
  },
});

export { expect };
