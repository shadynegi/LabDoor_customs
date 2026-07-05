import { test, expect } from '../../fixtures/storefront';
import { devices } from '@playwright/test';

test.use({ ...devices['Pixel 5'] });

test.describe('Mobile UI', () => {
  test('home page renders on mobile viewport', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page).toHaveTitle(/Lab Door/i);
  });

  test('products grid loads on mobile', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByText('Nike Drops - Blue')).toBeVisible({ timeout: 15_000 });
  });

  test('cart nav link is visible on small screens', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('a[href="/cart"]')).toBeVisible();
  });
});
