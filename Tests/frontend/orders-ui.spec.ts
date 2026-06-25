import { test, expect } from './fixtures/storefront';

test.describe('Orders page UI', () => {
  test('strips legacy token query params with deprecation warning', async ({ page }) => {
    await page.goto('/orders?orderNumber=GSS-TEST&token=legacytokenvalue12345678901234567890123456789012');
    await expect(
      page.getByText(/Token links in the URL are deprecated/i).first()
    ).toBeVisible({ timeout: 15_000 });
  });

  test('redeems email ?code= link and shows order status', async ({ page }) => {
    await page.goto('/orders?code=EMAIL-LINK-CODE');
    await expect(page.getByText(/preparing your order/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\$98(\.00)?/)).toBeVisible();
    await expect(page).toHaveURL(/\/orders$/);
  });
});
