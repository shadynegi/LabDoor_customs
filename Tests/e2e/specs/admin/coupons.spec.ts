import { test, expect } from '../../fixtures/admin';
import { PRIMARY_MOCK_PRODUCT } from '../../fixtures/mock-data';
import { seedCart } from '../../helpers/ui';
import {
  loginToAdminDashboard,
  openAdminTab,
  createCoupon,
  couponRow,
  expectToast,
} from '../../helpers/admin-modules';

test.describe('Admin Coupons module', () => {
  test.beforeEach(async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Coupons');
    await expect(page.getByText('EXISTING10')).toBeVisible({ timeout: 15_000 });
  });

  test('creates coupon with valid discount rules', async ({ page }) => {
    const createRequest = page.waitForRequest(
      (req) => req.url().includes('/api/coupons') && req.method() === 'POST',
    );

    await createCoupon(page, 'QA10OFF', '10');

    const req = await createRequest;
    const body = req.postDataJSON() as { code: string; discount_value: number; applies_to: string };
    expect(body.code).toBe('QA10OFF');
    expect(body.discount_value).toBe(10);
    expect(body.applies_to).toBe('all');

    await expect(couponRow(page, 'QA10OFF')).toBeVisible({ timeout: 15_000 });
  });

  test('validates empty coupon code on submit', async ({ page }) => {
    await page.locator('#admin-tabpanel-coupons').getByRole('button', { name: 'Create' }).click();
    await expectToast(page, 'Coupon code is required');
  });

  test('rejects duplicate coupon code from API', async ({ page }) => {
    await createCoupon(page, 'DUPE20', '20');
    await expect(couponRow(page, 'DUPE20')).toBeVisible({ timeout: 15_000 });

    await page.locator('#admin-coupon-custom-code').fill('DUPE20');
    await page.locator('#admin-coupon-custom-percent').selectOption('10');
    await page.locator('#admin-tabpanel-coupons').getByRole('button', { name: 'Create' }).click();

    await expectToast(page, /already exists/i);
    await expect(couponRow(page, 'DUPE20')).toHaveCount(1);
  });

  test('edits coupon description and max uses', async ({ page }) => {
    await page.getByTitle('Edit').first().click();
    await expect(page.getByRole('heading', { name: /Edit EXISTING10/i })).toBeVisible();

    const updateRequest = page.waitForRequest(
      (req) => /\/api\/coupons\//.test(req.url()) && req.method() === 'PUT',
    );

    await page.locator('#admin-coupon-edit-description').fill('Updated for QA regression');
    await page.locator('#admin-coupon-edit-max-uses').fill('50');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await updateRequest;
    await expectToast(page, 'Coupon EXISTING10 updated');
  });

  test('deactivates and reactivates coupon', async ({ page }) => {
    await createCoupon(page, 'TOGGLECPN', '10');
    const row = couponRow(page, 'TOGGLECPN');
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByTitle('Deactivate').click();
    await expect(row.getByText('Inactive')).toBeVisible();

    await row.getByTitle('Activate').click();
    await expect(row.getByText('Active')).toBeVisible();
  });

  test('deletes coupon and verifies removal', async ({ page }) => {
    await createCoupon(page, 'TODELETE', '10');
    const row = couponRow(page, 'TODELETE');
    await expect(row).toBeVisible({ timeout: 15_000 });

    const deleteRequest = page.waitForRequest(
      (req) => /\/api\/coupons\//.test(req.url()) && req.method() === 'DELETE',
    );

    await row.getByTitle('Delete').click();
    await page.getByRole('dialog', { name: 'Delete coupon' }).getByRole('button', { name: 'Delete' }).click();
    await deleteRequest;

    await expect(row).not.toBeVisible({ timeout: 15_000 });
  });

  test('applies admin-created coupon in checkout order flow', async ({ page }) => {
    await createCoupon(page, 'CHECKOUT20', '20');
    await expect(couponRow(page, 'CHECKOUT20')).toBeVisible({ timeout: 15_000 });

    const product = PRIMARY_MOCK_PRODUCT;
    await seedCart(page, [
      { id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 },
    ]);

    await page.goto('/checkout');
    await expect(page.getByText('Secure Checkout')).toBeVisible({ timeout: 15_000 });
    await page.getByPlaceholder('Enter code').fill('CHECKOUT20');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page.getByText('Coupon (CHECKOUT20)')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/20% discount applied/i)).toBeVisible();
  });
});
