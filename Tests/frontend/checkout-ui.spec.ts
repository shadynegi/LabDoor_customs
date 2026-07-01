import { test, expect } from './fixtures/storefront';
import { seedCart } from './helpers/ui';
import { PRIMARY_MOCK_PRODUCT } from './fixtures/mock-data';

test.describe('Checkout UI', () => {
  test('empty checkout shows cart empty messaging', async ({ page }) => {
    await page.goto('/checkout');
    await expect(page.getByText(/cart|empty/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('checkout with items shows secure checkout form', async ({ page }) => {
    const product = PRIMARY_MOCK_PRODUCT;
    await seedCart(page, [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      },
    ]);

    await page.goto('/checkout');
    await expect(page.getByText('Secure Checkout')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByLabel(/full name/i)).toBeVisible();
    await expect(page.getByLabel(/email/i).first()).toBeVisible();
  });

  test('checkout pre-selects United States country', async ({ page }) => {
    const product = PRIMARY_MOCK_PRODUCT;
    await seedCart(page, [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      },
    ]);

    await page.goto('/checkout');
    await expect(page.getByText('Secure Checkout')).toBeVisible({ timeout: 15_000 });

    await expect(page.locator('#country-input')).toHaveValue('United States of America (the)', {
      timeout: 10_000,
    });
  });
});
