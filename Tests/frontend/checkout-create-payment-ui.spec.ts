import { test, expect } from './fixtures/storefront';
import { seedCart } from './helpers/ui';
import { fillCheckoutCustomerForm, clickPayPalAndWaitForCreatePayment } from './helpers/checkout';
import { MOCK_PRODUCTS } from './fixtures/mock-data';

test.describe('Checkout create-payment UI', () => {
  test.describe.configure({ mode: 'serial' });

  test('submits create-payment after policy acceptance', async ({ page }) => {
    test.setTimeout(120_000);

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
    await fillCheckoutCustomerForm(page);

    const policyCheckbox = page
      .getByRole('checkbox', { name: /understand that all sales are final/i })
      .first();
    await policyCheckbox.scrollIntoViewIfNeeded();
    await policyCheckbox.check();
    await expect(policyCheckbox).toBeChecked();

    const paymentResponse = await clickPayPalAndWaitForCreatePayment(page);
    expect(paymentResponse.ok()).toBeTruthy();
  });
});
