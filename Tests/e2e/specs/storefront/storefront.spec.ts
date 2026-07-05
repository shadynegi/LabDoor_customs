import { test, expect } from '../../fixtures/storefront';

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

  test('shipping policy shows canonical rates', async ({ page }) => {
    await page.goto('/shipping-policy');
    await expect(page.getByRole('heading', { name: 'Shipping Policy' })).toBeVisible();
    const rates = page.getByTestId('shipping-policy-rates');
    await expect(rates).toContainText('$25');
    await expect(rates).toContainText('$200');
    await expect(rates).not.toContainText('$100');
    await expect(rates).not.toContainText('$5.99');
  });

  test('tall pages scroll on document', async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('lab_door_cookie_consent', new Date().toISOString());
    });
    await page.goto('/shipping-policy');
    await expect(page.getByRole('heading', { name: 'Shipping Policy' })).toBeVisible();
    const maxScroll = await page.evaluate(() =>
      Math.max(0, document.documentElement.scrollHeight - window.innerHeight),
    );
    expect(maxScroll).toBeGreaterThan(100);
    await page.evaluate((top) => {
      window.scrollTo({ top, behavior: 'instant' });
    }, Math.min(600, maxScroll));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  });
});
