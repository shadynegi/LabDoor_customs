import type { Page, Response } from '@playwright/test';
import { expect } from '@playwright/test';

function visiblePlaceOrderButton(page: Page) {
  return page.locator('button:visible', { hasText: /place order/i }).first();
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

/** Wait until cart validation finishes and Place Order is stably clickable. */
export async function waitForCheckoutPayReady(page: Page): Promise<void> {
  const placeOrderButton = visiblePlaceOrderButton(page);

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
        if (!(await placeOrderButton.isEnabled())) return false;
        await page.waitForTimeout(400);
        return (await isCartValidationIdle(page)) && placeOrderButton.isEnabled();
      },
      { timeout: 90_000, intervals: [300, 500, 1000] },
    )
    .toBe(true);
}

/** Fill minimal checkout customer fields for place-order tests. */
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
}

/** Click Place Order and wait for checkout API — listener registered before click. */
export async function clickPlaceOrderAndWaitForResponse(page: Page): Promise<Response> {
  await page.evaluate(async () => {
    await fetch('/api/csrf-token', { credentials: 'include' });
  });

  await waitForCheckoutPayReady(page);

  const placeOrderButton = visiblePlaceOrderButton(page);
  await placeOrderButton.scrollIntoViewIfNeeded();

  const waitForPlaceOrder = () =>
    page.waitForResponse(
      (res) =>
        res.url().includes('/checkout/place-order') &&
        res.request().method() === 'POST',
      { timeout: 60_000 },
    );

  const [response] = await Promise.all([waitForPlaceOrder(), placeOrderButton.click()]);
  return response;
}

/** @deprecated Use clickPlaceOrderAndWaitForResponse */
export const clickPayPalAndWaitForCreatePayment = clickPlaceOrderAndWaitForResponse;
