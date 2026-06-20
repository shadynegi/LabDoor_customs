import { test as base, expect } from '@playwright/test';
import { installStorefrontApiMocks } from '../helpers/mock-api';
import { preAcceptCookies } from '../helpers/ui';

/** Playwright test with API mocks and cookie consent pre-set. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await installStorefrontApiMocks(page);
    await preAcceptCookies(page);
    await use(page);
  },
});

export { expect };
