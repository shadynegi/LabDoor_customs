import { test, expect } from './fixtures/storefront';
import { seedCart } from './helpers/ui';
import { PRIMARY_MOCK_PRODUCT, TEST_PRODUCT_IDS } from './fixtures/mock-data';

test.describe('Responsive storefront UI', () => {
  test('checkout form fields are usable on mobile', async ({ page }) => {
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
    await expect(page.locator('#country-input')).toBeVisible();
    await expect(page.getByRole('checkbox', { name: /all sales are final/i })).toBeVisible();
  });

  test('cart page stacks actions on narrow viewport', async ({ page }) => {
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

    await page.goto('/cart');
    await expect(page.getByText(product.name)).toBeVisible({ timeout: 15_000 });
    const checkoutCta = page
      .getByRole('region', { name: 'Cart checkout actions' })
      .getByRole('button', { name: 'Checkout' });
    await expect(checkoutCta).toBeVisible({ timeout: 15_000 });
    await expect(checkoutCta).toBeEnabled();
    const viewport = page.viewportSize();
    expect(viewport?.width).toBeLessThanOrEqual(393);
  });

  test('product detail avoids horizontal overflow on mobile', async ({ page }) => {
    await page.goto(`/product/${TEST_PRODUCT_IDS.nikeBlue}`);
    await expect(page.getByRole('heading', { name: PRIMARY_MOCK_PRODUCT.name })).toBeVisible({
      timeout: 15_000,
    });

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });

  test('products sort dropdown fits narrow mobile viewports', async ({ page }) => {
    for (const width of [320, 360, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/products');
      await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({
        timeout: 15_000,
      });

      const sortSelect = page.getByLabel('Sort products');
      await expect(sortSelect).toBeVisible();
      await sortSelect.selectOption('price_asc');

      const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
      const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
      expect(scrollWidth, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(clientWidth + 2);

      const box = await sortSelect.boundingBox();
      expect(box?.width ?? 0, `sort select width at ${width}px`).toBeGreaterThan(0);
      expect(box!.x + box!.width, `sort select off-screen at ${width}px`).toBeLessThanOrEqual(
        clientWidth + 2,
      );
    }
  });
});

test.describe('Responsive admin UI', () => {
  test('admin login form fits mobile viewport', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 2);
  });
});
