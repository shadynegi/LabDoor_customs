import { test, expect } from './fixtures/storefront';
import { TEST_PRODUCT_IDS } from './fixtures/mock-data';

test.describe('Products UI', () => {
  test('lists mocked products with titles and prices', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible();
    await expect(page.getByText('Nike Drops - Blue')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Golden ESSENCE')).toBeVisible();
    await expect(page.getByText('$98').first()).toBeVisible();
  });

  test('product detail disables add to cart until size is selected', async ({ page }) => {
    await page.goto(`/product/${TEST_PRODUCT_IDS.nikeBlue}`);
    await expect(page.getByRole('heading', { name: 'Nike Drops - Blue' })).toBeVisible({
      timeout: 15_000,
    });

    const addToCart = page.getByRole('button', { name: 'Add to Cart' }).first();
    await expect(page.getByRole('button', { name: 'Select a Size' }).first()).toBeVisible();
    await expect(addToCart).toHaveCount(0);

    await page.getByRole('button', { name: '10', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Add to Cart' }).first()).toBeEnabled();
  });

  test('product detail shows out of stock state', async ({ page }) => {
    await page.goto(`/product/${TEST_PRODUCT_IDS.goldenEssence}`);
    await expect(page.getByRole('heading', { name: 'Golden ESSENCE' })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Out of Stock').first()).toBeVisible();
  });
});
