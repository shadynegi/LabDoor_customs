import { test as base, expect } from '@playwright/test';
import { installStorefrontApiMocks } from '../helpers/mock-api';
import { preAcceptCookies } from '../helpers/ui';

type StorefrontFixtures = {
  /** When set, create-payment mock returns this server total (mismatch UI tests). */
  createPaymentTotal: number | undefined;
};

/** Playwright test with API mocks and cookie consent pre-set. */
export const test = base.extend<StorefrontFixtures>({
  createPaymentTotal: [undefined, { option: true }],
  page: async ({ page, createPaymentTotal }, use) => {
    await installStorefrontApiMocks(page, { createPaymentTotal });
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
