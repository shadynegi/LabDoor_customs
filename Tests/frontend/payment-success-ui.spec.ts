import { test, expect } from './fixtures/storefront';

test.describe('Payment success edge UI', () => {
  test('shows error when PayPal token is missing', async ({ page }) => {
    await page.goto('/payment/success?code=test-exchange');
    await expect(
      page.getByText(/PayPal did not return a payment reference/i)
    ).toBeVisible({ timeout: 15_000 });
  });
});
