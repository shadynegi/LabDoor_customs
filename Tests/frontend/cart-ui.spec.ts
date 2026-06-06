import { test, expect } from './fixtures/storefront';
import { seedCart } from './helpers/ui';
import { MOCK_PRODUCTS } from './fixtures/mock-data';

test.describe('Cart UI', () => {
  test('empty cart shows start shopping message', async ({ page }) => {
    await page.goto('/cart');
    await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible();
    await expect(page.getByText('Your cart is empty')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Start Shopping' })).toBeVisible();
  });

  test('seeded cart shows line item and checkout link', async ({ page }) => {
    const product = MOCK_PRODUCTS[0];
    await seedCart(page, [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 1,
      },
    ]);

    await page.goto('/cart');
    await expect(page.getByText(product.name)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('$98').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: /Proceed to Checkout|Checkout/i }).first(),
    ).toBeVisible();
  });

  test('cart badge reflects item count in navigation', async ({ page }) => {
    const product = MOCK_PRODUCTS[0];
    await seedCart(page, [
      {
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.image,
        quantity: 2,
      },
    ]);

    await page.goto('/products');
    await expect(page.locator('nav').getByText('2', { exact: true })).toBeVisible({
      timeout: 15_000,
    });
  });
});
