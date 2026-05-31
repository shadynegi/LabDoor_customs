import { test, expect } from '@playwright/test';

test.describe('Storefront smoke', () => {
  test('home page renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page).toHaveTitle(/Lab Door/i);
  });

  test('products page renders', async ({ page }) => {
    await page.goto('/products');
    await expect(page.locator('#root')).toBeVisible();
  });

  test('checkout route loads', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.locator('#root')).toBeVisible();
    await expect(page.getByText(/checkout|cart|empty/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('contact page renders', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('#root')).toBeVisible();
  });
});
