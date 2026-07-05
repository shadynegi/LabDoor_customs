import { test, expect } from '../../fixtures/admin';
import { TEST_PRODUCT_IDS } from '../../fixtures/mock-data';
import {
  loginToAdminDashboard,
  openAdminTab,
  openCreateProductForm,
  openEditProductForm,
  fillProductForm,
  submitProductForm,
  productRow,
  expectToast,
} from '../../helpers/admin-modules';

test.describe('Admin Products module', () => {
  test.beforeEach(async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Products');
  });

  test('creates product successfully with valid data', async ({ page }) => {
    await expect(page.getByText('Nike Drops - Blue')).toBeVisible({ timeout: 15_000 });

    const createRequest = page.waitForRequest(
      (req) => req.url().includes('/api/products') && req.method() === 'POST',
    );

    await openCreateProductForm(page);
    await fillProductForm(page, {
      name: 'E2E Catalog Shoe',
      price: '149',
      stock: '8',
      image: '/assets/blue-nike.png',
      description: 'Playwright catalog product',
    });
    await submitProductForm(page, 'create');

    const req = await createRequest;
    const body = req.postDataJSON() as { name: string; price: number; stock: number };
    expect(body.name).toBe('E2E Catalog Shoe');
    expect(body.price).toBe(149);
    expect(body.stock).toBe(8);

    await expect(productRow(page, 'E2E Catalog Shoe')).toBeVisible({ timeout: 15_000 });
  });

  test('shows required field errors on empty submit', async ({ page }) => {
    await openCreateProductForm(page);
    await page.getByRole('button', { name: 'Create Product' }).click();
    await expectToast(page, 'Product name is required');
  });

  test('edits product details (name, price, image, inventory)', async ({ page }) => {
    await expect(page.getByText('Nike Drops - Blue')).toBeVisible({ timeout: 15_000 });

    const updateRequest = page.waitForRequest(
      (req) => /\/api\/products\/\d+$/.test(req.url()) && req.method() === 'PUT',
    );

    await openEditProductForm(page, 'Nike Drops - Blue');
    await fillProductForm(page, {
      name: 'Nike Drops - Blue (QA)',
      price: '109',
      stock: '15',
      image: '/assets/gold-black-nike.png',
    });
    await submitProductForm(page, 'edit');

    const req = await updateRequest;
    const body = req.postDataJSON() as { name: string; price: number; stock: number; image: string };
    expect(body.name).toContain('QA');
    expect(body.price).toBe(109);
    expect(body.stock).toBe(15);
    expect(body.image).toContain('gold-black-nike');

    await expect(page.getByText('Nike Drops - Blue (QA)')).toBeVisible({ timeout: 15_000 });
  });

  test('deletes product and confirms removal from list', async ({ page }) => {
    await openCreateProductForm(page);
    await fillProductForm(page, {
      name: 'Disposable QA Shoe',
      price: '99',
      stock: '3',
      image: '/assets/blue-nike.png',
    });
    await submitProductForm(page, 'create');
    await expect(productRow(page, 'Disposable QA Shoe')).toBeVisible({ timeout: 15_000 });

    const deleteRequest = page.waitForRequest(
      (req) => /\/api\/products\/\d+$/.test(req.url()) && req.method() === 'DELETE',
    );

    await productRow(page, 'Disposable QA Shoe')
      .getByRole('button', { name: 'Delete product', exact: true })
      .click();
    await expect(page.getByRole('heading', { name: 'Delete product' })).toBeVisible();
    await page.getByRole('dialog', { name: 'Delete product' }).getByRole('button', { name: 'Delete' }).click();

    await deleteRequest;
    await expect(page.getByText('Disposable QA Shoe')).not.toBeVisible({ timeout: 15_000 });
  });

  test('shows created product in admin listing and public catalog', async ({ page }) => {
    await openCreateProductForm(page);
    await fillProductForm(page, {
      name: 'Public Listing Shoe',
      price: '120',
      stock: '5',
      image: '/assets/blue-nike.png',
    });
    await submitProductForm(page, 'create');
    await expect(productRow(page, 'Public Listing Shoe')).toBeVisible({ timeout: 15_000 });

    await page.goto('/');
    await expect(page.getByText('Public Listing Shoe').first()).toBeVisible({ timeout: 15_000 });
  });

  test('displays image URL in edit form after save', async ({ page }) => {
    await openCreateProductForm(page);
    await fillProductForm(page, {
      name: 'Image Display Shoe',
      price: '88',
      stock: '4',
      image: '/assets/gold-black-nike.png',
    });
    await submitProductForm(page, 'create');
    await expect(productRow(page, 'Image Display Shoe')).toBeVisible({ timeout: 15_000 });

    await openEditProductForm(page, 'Image Display Shoe');
    await expect(page.locator('#admin-product-image')).toHaveValue('/assets/gold-black-nike.png');
  });

  test('toggles out-of-stock via list switch', async ({ page }) => {
    const row = productRow(page, 'Nike Drops - Blue');
    const productSwitch = row.getByRole('switch');
    await expect(productSwitch).toHaveAttribute('aria-checked', 'false');

    const updateRequest = page.waitForRequest((req) => {
      if (!/\/api\/products\/\d+$/.test(req.url()) || req.method() !== 'PUT') return false;
      try {
        return (req.postDataJSON() as { is_out_of_stock?: boolean }).is_out_of_stock === true;
      } catch {
        return false;
      }
    });

    await productSwitch.click();
    await updateRequest;
    await expect(row.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  test('filters products via admin search', async ({ page }) => {
    const searchRequest = page.waitForRequest(
      (req) => req.url().includes('/api/products/search') && req.method() === 'POST',
    );

    await page.locator('#admin-product-search').fill('Golden');
    await searchRequest;

    await expect(page.getByText('Golden ESSENCE')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Nike Drops - Blue')).not.toBeVisible();
  });

  test('product detail page loads for existing catalog item', async ({ page }) => {
    await page.goto(`/product/${TEST_PRODUCT_IDS.nikeBlue}`);
    await expect(page.getByText('Nike Drops - Blue')).toBeVisible({ timeout: 15_000 });
  });
});
