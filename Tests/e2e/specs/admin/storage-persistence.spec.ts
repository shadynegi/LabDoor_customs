import { test, expect } from '../../fixtures/admin';
import {
  loginToAdminDashboard,
  openAdminTab,
  openCreateProductForm,
  fillProductForm,
  submitProductForm,
  productRow,
  openEditProductForm,
  expectToast,
} from '../../helpers/admin-modules';

const TINY_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

test.describe('Admin storage persistence (mocked Railway upload)', () => {
  test.beforeEach(async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Products');
  });

  test('uploads image via admin API and persists URL on product save', async ({ page }) => {
    await openCreateProductForm(page);
    await page.locator('#admin-product-name').fill('Upload Persist Shoe');
    await page.locator('#admin-product-price').fill('140');
    await page.locator('#admin-product-stock').fill('4');

    await page.locator('#admin-product-image-file').setInputFiles({
      name: 'test-upload.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });

    const uploadRequest = page.waitForRequest(
      (req) => req.url().includes('/api/admin/uploads/product-media') && req.method() === 'POST',
    );
    const createRequest = page.waitForRequest(
      (req) => req.url().includes('/api/products') && req.method() === 'POST',
    );

    await submitProductForm(page, 'create');
    await uploadRequest;
    const createReq = await createRequest;
    const body = createReq.postDataJSON() as { image: string };
    expect(body.image).toContain('/uploads/playwright-persisted-image.png');

    await expect(productRow(page, 'Upload Persist Shoe')).toBeVisible({ timeout: 15_000 });
  });

  test('persisted image URL survives navigating away from Products tab', async ({ page }) => {
    await openCreateProductForm(page);
    await fillProductForm(page, {
      name: 'Reload Persist Shoe',
      price: '99',
      stock: '3',
      image: '/uploads/playwright-persisted-image.png',
    });
    await submitProductForm(page, 'create');
    await expect(productRow(page, 'Reload Persist Shoe')).toBeVisible({ timeout: 15_000 });

    await openAdminTab(page, 'Orders');
    await expect(page.getByText('#GSS-ADMIN-PENDING')).toBeVisible({ timeout: 15_000 });
    await openAdminTab(page, 'Products');

    await openEditProductForm(page, 'Reload Persist Shoe');
    await expect(page.locator('#admin-product-image')).toHaveValue('/uploads/playwright-persisted-image.png');
  });

  test('shows error when upload storage endpoint fails', async ({ page }) => {
    await page.route('**/api/admin/uploads/product-media', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/json',
        body: JSON.stringify({ success: false, error: 'Upload storage unavailable' }),
      });
    });

    await openCreateProductForm(page);
    await page.locator('#admin-product-name').fill('Broken Upload Shoe');
    await page.locator('#admin-product-price').fill('80');
    await page.locator('#admin-product-stock').fill('2');
    await page.locator('#admin-product-image-file').setInputFiles({
      name: 'broken.png',
      mimeType: 'image/png',
      buffer: TINY_PNG,
    });

    await submitProductForm(page, 'create');
    await expectToast(page, /upload|unavailable|failed/i);
  });
});
