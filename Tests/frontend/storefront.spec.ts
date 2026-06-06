import { test, expect } from './fixtures/storefront';

test.describe('Storefront smoke', () => {
  test('home page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page).toHaveTitle(/Lab Door/i);
  });

  test('products page renders with catalog', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({
      timeout: 15_000,
    });
  });

  test('checkout route loads', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByText(/checkout|cart|empty/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('contact page renders', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();
  });
});
