import { test, expect } from './fixtures/storefront';

const ORDER_ID = '00000000-0000-0000-0000-00000000ee01';
const SHIPPED_ORDER_ID = '00000000-0000-0000-0000-00000000ee02';
const LOOKUP_EMAIL = 'orders-ui@example.com';

test.describe('Orders page UI', () => {
  test('prefills orderId from email link query param', async ({ page }) => {
    await page.goto(`/orders?orderId=${ORDER_ID}`);
    await expect(page.getByPlaceholder(/00000000-0000-0000/i)).toHaveValue(ORDER_ID);
    await expect(page).toHaveURL(/\/orders$/);
  });

  test('lookup with orderId and email shows order status', async ({ page }) => {
    await page.goto('/orders');
    await page.getByPlaceholder(/00000000-0000-0000/i).fill(ORDER_ID);
    await page.getByPlaceholder('you@example.com').fill(LOOKUP_EMAIL);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(/preparing your order/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\$98(\.00)?/)).toBeVisible();
    await expect(page.getByText(/TEST-ABC/i)).toBeVisible();
  });

  test('persists tracked order in sessionStorage after successful lookup', async ({ page }) => {
    await page.goto('/orders');
    await page.getByPlaceholder(/00000000-0000-0000/i).fill(ORDER_ID);
    await page.getByPlaceholder('you@example.com').fill(LOOKUP_EMAIL);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(/preparing your order/i).first()).toBeVisible({ timeout: 15_000 });

    const stored = await page.evaluate(() => sessionStorage.getItem('labdoor_tracked_orders'));
    expect(stored).toContain(ORDER_ID);
    expect(stored).toContain(LOOKUP_EMAIL);
  });

  test('shows error when orderId and email do not match', async ({ page }) => {
    await page.goto('/orders');
    await page.getByPlaceholder(/00000000-0000-0000/i).fill(ORDER_ID);
    await page.getByPlaceholder('you@example.com').fill('wrong@example.com');
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(/order not found/i).first()).toBeVisible({ timeout: 15_000 });
  });

  test('shipped order shows tracking link', async ({ page }) => {
    await page.goto('/orders');
    await page.getByPlaceholder(/00000000-0000-0000/i).fill(SHIPPED_ORDER_ID);
    await page.getByPlaceholder('you@example.com').fill(LOOKUP_EMAIL);
    await page.getByRole('button', { name: 'Search' }).click();
    await expect(page.getByText(/on the way to you/i).first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: /track package/i })).toBeVisible();
  });
});
