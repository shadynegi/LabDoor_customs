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
    await use(page);
  },
});

export { expect };
