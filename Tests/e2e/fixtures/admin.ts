import { test as base, expect } from '@playwright/test';
import { installAdminApiMocks } from '../helpers/mock-admin-api';
import { preAcceptCookies } from '../helpers/ui';

/** Playwright test with admin API mocks and cookie consent pre-set. */
export const test = base.extend({
  page: async ({ page }, use) => {
    await installAdminApiMocks(page);
    await preAcceptCookies(page);
    await use(page);
  },
});

export { expect };
