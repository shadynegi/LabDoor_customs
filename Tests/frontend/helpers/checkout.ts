import type { Page, Response } from '@playwright/test';
import { expect } from '@playwright/test';
import { buildPlaceOrderMockResponse, type PlaceOrderMockResponse } from './mock-api';

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

  // Checkout may have already validated the cart before this helper runs — wait briefly,
  // but do not loop on 20s timeouts (that alone can exceed the test timeout).
  await page
    .waitForResponse(
      (response) =>
        response.url().includes('/products/validate-cart') &&
        response.request().method() === 'POST' &&
        response.ok(),
      { timeout: 10_000 },
    )
    .catch(() => undefined);

  await expect
    .poll(
      async () => {
        if (!(await isCartValidationIdle(page))) return false;
        if (!(await placeOrderButton.isEnabled())) return false;
        await page.waitForTimeout(200);
        return (await isCartValidationIdle(page)) && placeOrderButton.isEnabled();
      },
      { timeout: 60_000, intervals: [300, 500, 1000] },
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

export type PlaceOrderResponseBody = PlaceOrderMockResponse;

async function blockWhatsAppNavigation(page: Page): Promise<void> {
  await page.evaluate(() => {
    sessionStorage.removeItem('__waRedirect');
    const native = window.location;
    const captureWa = (url: string) => {
      if (String(url).includes('wa.me')) {
        sessionStorage.setItem('__waRedirect', url);
        return true;
      }
      return false;
    };
    window.location.assign = (url: string) => {
      if (!captureWa(url)) native.assign(url);
    };
    window.location.replace = (url: string) => {
      if (!captureWa(url)) native.replace(url);
    };
    try {
      Object.defineProperty(window.location, 'href', {
        configurable: true,
        set(url: string) {
          if (!captureWa(url)) {
            native.href = url;
          }
        },
        get() {
          return native.href;
        },
      });
    } catch {
      // Some browsers lock location.href; assign/replace interception still helps.
    }
  });
}

/** Click Place Order and wait for checkout API — listener registered before click. */
export async function clickPlaceOrderAndWaitForResponse(page: Page): Promise<{
  response: Response;
  body: PlaceOrderResponseBody;
}> {
  await blockWhatsAppNavigation(page);

  let capturedBody: PlaceOrderResponseBody | null = null;
  const captureRoute = async (route: import('@playwright/test').Route) => {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    let postData: { amount?: string } = {};
    try {
      postData = route.request().postDataJSON() as typeof postData;
    } catch {
      postData = {};
    }
    capturedBody = buildPlaceOrderMockResponse(postData);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(capturedBody),
    });
  };

  await page.route('**/api/checkout/place-order', captureRoute);

  try {
    await page.evaluate(async () => {
      await fetch('/api/csrf-token', { credentials: 'include' });
    });

    await waitForCheckoutPayReady(page);

    const placeOrderButton = visiblePlaceOrderButton(page);
    await placeOrderButton.scrollIntoViewIfNeeded();

    const responsePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/checkout/place-order') && res.request().method() === 'POST',
      { timeout: 60_000 },
    );

    await placeOrderButton.click();
    await expect.poll(() => capturedBody, { timeout: 15_000 }).not.toBeNull();

    const response = await responsePromise;
    return { response, body: capturedBody! };
  } finally {
    await page.unroute('**/api/checkout/place-order', captureRoute);
  }
}

/** @deprecated Use clickPlaceOrderAndWaitForResponse */
export const clickPayPalAndWaitForCreatePayment = clickPlaceOrderAndWaitForResponse;
