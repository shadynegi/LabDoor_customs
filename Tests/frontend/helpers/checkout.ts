import type { Page, Response } from '@playwright/test';
import { expect } from '@playwright/test';

/** Wait until cart validation finishes and the PayPal button is clickable. */
export async function waitForCheckoutPayReady(page: Page): Promise<void> {
  const payButton = page.getByRole('button', { name: /pay with paypal/i }).first();

  // Cart validation can re-run after REFRESH_PRICES — drain a few cycles.
  for (let i = 0; i < 3; i++) {
    await page
      .waitForResponse(
        (response) =>
          response.url().includes('/products/validate-cart') &&
          response.request().method() === 'POST' &&
          response.ok(),
        { timeout: 15_000 },
      )
      .catch(() => undefined);
  }

  await expect(payButton).toBeEnabled({ timeout: 45_000 });
}

/** Fill minimal checkout customer fields for PayPal redirect tests. */
export async function fillCheckoutCustomerForm(page: Page): Promise<void> {
  await page.waitForResponse(
    (response) =>
      response.url().includes('/products/validate-cart') &&
      response.request().method() === 'POST' &&
      response.ok(),
    { timeout: 30_000 },
  ).catch(() => undefined);

  await page.getByLabel(/full name/i).fill('Playwright Buyer');
  await page.getByLabel(/email/i).first().fill('buyer@example.com');
  await page.getByLabel(/phone/i).fill('5551234567');
  await page.getByLabel(/street address/i).fill('123 Test Street Suite 100');
  await page.getByLabel(/city/i).fill('New York');
  await page.getByLabel(/state \/ province/i).fill('NY');
  await page.getByLabel(/zip \/ postal code/i).fill('10001');
  await expect(page.locator('#country-input')).toHaveValue(/United States/i);
}

/** Click PayPal and wait for create-payment — listener registered before click to avoid races. */
export async function clickPayPalAndWaitForCreatePayment(page: Page): Promise<Response> {
  await waitForCheckoutPayReady(page);

  const payButton = page.getByRole('button', { name: /pay with paypal/i }).first();
  const [response] = await Promise.all([
    page.waitForResponse(
      (res) =>
        res.url().includes('/paypal/create-payment') &&
        res.request().method() === 'POST',
      { timeout: 60_000 },
    ),
    payButton.click(),
  ]);

  return response;
}
