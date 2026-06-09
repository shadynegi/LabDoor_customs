import { test, expect } from './fixtures/storefront';

test.describe('Orders page UI', () => {
  test('strips legacy token query params with deprecation warning', async ({ page }) => {
    await page.goto('/orders?orderNumber=GSS-TEST&token=legacytokenvalue12345678901234567890123456789012');
    await expect(
      page.getByText(/Token links in the URL are deprecated/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
