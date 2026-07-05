import { test, expect } from '../../fixtures/storefront';

test.describe('Navigation UI', () => {
  test('products page shows sticky nav with cart link', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('link', { name: /cart/i }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /orders/i }).first()).toBeVisible();
  });

  test('logo navigates home from products', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('link', { name: 'Lab Door Customs Logo' }).click();
    await expect(page).toHaveURL('/');
    await expect(page).toHaveTitle(/Lab Door/i);
  });

  test('contact page is reachable from footer or direct route', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();
  });
});
