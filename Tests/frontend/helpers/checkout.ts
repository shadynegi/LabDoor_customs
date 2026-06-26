import type { Page, Response } from '@playwright/test';
import { expect } from '@playwright/test';

function visiblePayPalButton(page: Page) {
  return page.locator('button:visible', { hasText: /pay with paypal/i }).first();
}

async function isCartValidationIdle(page: Page): Promise<boolean> {
  const validating = await page
    .locator('button')
    .filter({ hasText: /^Validating/ })
    .first()
    .isVisible()
    .catch(() => false);
  if (validating) return false;

  const cartError = await page
    .getByText(/unable to validate cart|cart validation failed|unavailable/i)
    .first()
    .isVisible()
    .catch(() => false);
  return !cartError;
}

/** Wait until cart validation finishes and the PayPal button is stably clickable. */
export async function waitForCheckoutPayReady(page: Page): Promise<void> {
  const payButton = visiblePayPalButton(page);

  // Cart validation can re-run after REFRESH_PRICES — drain a few cycles.
  for (let i = 0; i < 10; i++) {
    await page
      .waitForResponse(
        (response) =>
          response.url().includes('/products/validate-cart') &&
          response.request().method() === 'POST' &&
          response.ok(),
        { timeout: 20_000 },
      )
      .catch(() => undefined);
    await page.waitForTimeout(150);
  }

  await expect
    .poll(
      async () => {
        if (!(await isCartValidationIdle(page))) return false;
        if (!(await payButton.isEnabled())) return false;
        await page.waitForTimeout(400);
        return (await isCartValidationIdle(page)) && payButton.isEnabled();
      },
      { timeout: 90_000, intervals: [300, 500, 1000] },
    )
    .toBe(true);
}

/** Fill minimal checkout customer fields for PayPal redirect tests. */
export async function fillCheckoutCustomerForm(page: Page): Promise<void> {
  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/products/validate-cart') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 30_000 },
    )
    .catch(() => undefined);

  const fill = async (selector: string, value: string) => {
    const field = page.locator(selector);
    await field.fill(value);
    await field.blur();
  };

  await fill('#fullName', 'Playwright Buyer');
  await fill('#email', 'buyer@example.com');
  await fill('#phone', '5551234567');
  await fill('#address', '123 Test Street Suite 100');
  await fill('#city', 'New York');
  await fill('#state', 'NY');
  await fill('#zipCode', '10001');
  await expect(page.locator('#country-input')).toHaveValue(/United States/i);

  await expect(page.locator('#fullName')).toHaveValue('Playwright Buyer');
  await expect(page.locator('#email')).toHaveValue('buyer@example.com');
  await expect(page.locator('#phone')).toHaveValue('5551234567');
  await expect(page.locator('#address')).toHaveValue('123 Test Street Suite 100');
  await expect(page.locator('#city')).toHaveValue('New York');
  await expect(page.locator('#state')).toHaveValue('NY');
  await expect(page.locator('#zipCode')).toHaveValue('10001');
}

/** Click PayPal and wait for create-payment — listener registered before click to avoid races. */
export async function clickPayPalAndWaitForCreatePayment(page: Page): Promise<Response> {
  await page.evaluate(async () => {
    await fetch('/api/csrf-token', { credentials: 'include' });
  });

  await waitForCheckoutPayReady(page);

  const payButton = visiblePayPalButton(page);
  await payButton.scrollIntoViewIfNeeded();

  const waitForCreatePayment = () =>
    page.waitForResponse(
      (res) =>
        res.url().includes('/paypal/create-payment') &&
        res.request().method() === 'POST',
      { timeout: 60_000 },
    );

  const [response] = await Promise.all([waitForCreatePayment(), payButton.click()]);
  return response;
}
