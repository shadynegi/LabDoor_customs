import { test, expect } from './fixtures/storefront';
import { seedCart } from './helpers/ui';
import { installPaymentTotalMismatchMock } from './helpers/mock-api';
import { MOCK_PRODUCTS } from './fixtures/mock-data';

test.describe('Checkout total mismatch UI', () => {
  test.describe.configure({ mode: 'serial' });

  test('blocks PayPal redirect when server total differs from client total', async ({ page }) => {
    test.setTimeout(60_000);

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

    await installPaymentTotalMismatchMock(page);

    await page.goto('/cart');
    await expect(page.getByRole('button', { name: 'Proceed to Checkout' })).toBeVisible({
      timeout: 20_000,
    });

    const cartValidated = page.waitForResponse(
      (response) =>
        response.url().includes('/products/validate-cart') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 30_000 },
    );
    await page.goto('/checkout');
    await cartValidated;
    await expect(page.getByText('Secure Checkout')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('$123.00').first()).toBeVisible({ timeout: 15_000 });

    await page.getByLabel(/full name/i).fill('Test Buyer');
    await page.getByLabel(/email/i).first().fill('buyer@example.com');
    await page.getByLabel(/phone/i).fill('5551234567');
    await page.getByLabel(/street address/i).fill('123 Test Street Suite 100');
    await page.getByLabel(/city/i).fill('Testville');
    await page.getByLabel(/state/i).fill('CA');
    await page.getByLabel(/ZIP \/ Postal Code/i).fill('12345');

    const payButton = page.locator('button:visible', { hasText: 'Pay with PayPal' });
    await expect(payButton).toBeEnabled({ timeout: 30_000 });

    await payButton.click();

    await expect(page.getByText(/Pricing was updated/i)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/\$999\.99/)).toBeVisible();
    await expect(page).toHaveURL(/\/checkout/);
    await expect(
      page.evaluate(() => sessionStorage.getItem('pendingOrder')),
    ).resolves.toBeNull();
  });
});
