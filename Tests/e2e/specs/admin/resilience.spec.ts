import { test, expect } from '@playwright/test';
import { installAdminApiMocks } from '../../helpers/mock-admin-api';
import { preAcceptCookies } from '../../helpers/ui';
import {
  loginToAdminDashboard,
  openAdminTab,
  openCreateProductForm,
  fillProductForm,
  createCoupon,
  expectToast,
} from '../../helpers/admin-modules';

test.describe('Admin resilience and negative paths', () => {
  test('redirects unauthenticated dashboard access to login', async ({ page }) => {
    await page.goto('/adminshivamdashboard');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
  });

  test('returns 401 for protected admin API without login', async ({ page }) => {
    await installAdminApiMocks(page);
    await preAcceptCookies(page);
    await page.goto('/');
    const status = await page.evaluate(async () => {
      const res = await fetch('/api/admin/analytics');
      return res.status;
    });
    expect(status).toBe(401);
  });

  test('handles product save API failure and shows error toast', async ({ page }) => {
    await installAdminApiMocks(page);
    await preAcceptCookies(page);
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Products');

    await page.route('**/api/products', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Database unavailable' }),
        });
        return;
      }
      await route.fallback();
    });

    await openCreateProductForm(page);
    await fillProductForm(page, {
      name: 'Fail Save Shoe',
      price: '99',
      stock: '1',
      image: '/assets/blue-nike.png',
    });
    await page.getByRole('button', { name: 'Create Product' }).click();
    await expectToast(page, /failed|unavailable/i);
  });

  test('handles coupon create API failure gracefully', async ({ page }) => {
    await installAdminApiMocks(page);
    await preAcceptCookies(page);
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Coupons');

    await page.route('**/api/coupons', async (route) => {
      if (route.request().method() === 'POST') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ success: false, error: 'Coupon service down' }),
        });
        return;
      }
      await route.fallback();
    });

    await page.locator('#admin-coupon-custom-code').fill('FAIL500');
    await page.locator('#admin-coupon-custom-percent').selectOption('10');
    await page.getByTestId('admin-coupon-create').click();
    await expectToast(page, /failed|down/i);
  });

  test('handles network abort during product update', async ({ page }) => {
    await installAdminApiMocks(page);
    await preAcceptCookies(page);
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Products');
    await expect(page.getByText('Nike Drops - Blue')).toBeVisible({ timeout: 15_000 });

    await page.route(/\/api\/products\/\d+$/, async (route) => {
      if (route.request().method() === 'PUT') {
        await route.abort('failed');
        return;
      }
      await route.fallback();
    });

    const row = page.locator('tr', { hasText: 'Nike Drops - Blue' });
    await row.getByRole('switch').click();
    await expectToast(page, /failed|update/i);
  });

  test('rejects partial product form without image URL or upload', async ({ page }) => {
    await installAdminApiMocks(page);
    await preAcceptCookies(page);
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Products');

    await openCreateProductForm(page);
    await page.locator('#admin-product-name').fill('No Image Shoe');
    await page.locator('#admin-product-price').fill('50');
    await page.getByRole('button', { name: 'Create Product' }).click();
    await expectToast(page, /image is required/i);
  });
});
