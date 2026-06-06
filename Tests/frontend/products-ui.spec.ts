import { test, expect } from './fixtures/storefront';

test.describe('Products UI', () => {
  test('lists mocked products with titles and prices', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible();
    await expect(page.getByText('Nike Drops - Blue')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Golden ESSENCE')).toBeVisible();
    await expect(page.getByText('$98').first()).toBeVisible();
  });

  test('product detail shows add to cart for in-stock item', async ({ page }) => {
    await page.goto('/product/1');
    await expect(page.getByRole('heading', { name: 'Nike Drops - Blue' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole('button', { name: 'Add to Cart' }).first()).toBeVisible();
  });

  test('product detail shows out of stock state', async ({ page }) => {
    await page.goto('/product/2');
    await expect(page.getByRole('heading', { name: 'Golden ESSENCE' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Out of Stock').first()).toBeVisible();
  });
});
