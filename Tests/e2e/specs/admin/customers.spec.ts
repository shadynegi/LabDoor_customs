import { test, expect } from '../../fixtures/admin';
import {
  loginToAdminDashboard,
  openAdminTab,
  customerRow,
  customerHistoryModal,
  expectToast,
} from '../../helpers/admin-modules';

test.describe('Admin Customers module', () => {
  test.beforeEach(async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Customers');
  });

  test('manual customer create is not available in admin UI', async ({ page }) => {
    await expect(page.getByText('pending@example.com')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: /Add customer/i })).not.toBeVisible();
    await expect(page.getByRole('button', { name: /Create customer/i })).not.toBeVisible();
  });

  test('views customer profile in history modal', async ({ page }) => {
    const historyRequest = page.waitForRequest(
      (req) =>
        req.url().includes('/api/admin/customers/') &&
        req.url().includes('pending') &&
        req.method() === 'GET',
    );

    await customerRow(page, 'pending@example.com').getByRole('button', { name: 'View History' }).click();
    await historyRequest;

    const modal = customerHistoryModal(page);
    await expect(modal.getByRole('heading', { name: /Pending Buyer/i })).toBeVisible();
    await expect(modal.getByText('pending@example.com')).toBeVisible();
    await expect(modal.getByText('Total Orders')).toBeVisible();
    await expect(modal.getByText('Total Spent')).toBeVisible();
  });

  test('edits customer CRM details via PATCH', async ({ page }) => {
    await customerRow(page, 'pending@example.com').getByRole('button', { name: 'Edit', exact: true }).click();

    const patchRequest = page.waitForRequest(
      (req) => /\/api\/admin\/customers\/\d+$/.test(req.url()) && req.method() === 'PATCH',
    );

    await page.locator('#admin-customer-edit-name').fill('Pending Buyer (Edited)');
    await page.locator('#admin-customer-edit-phone').fill('+1-555-9999');
    await page.locator('#admin-customer-edit-notes').fill('VIP test customer');
    await page.getByRole('button', { name: 'Save' }).click();

    await patchRequest;
    await expect(page.getByText('Pending Buyer (Edited)')).toBeVisible({ timeout: 15_000 });
  });

  test('soft-deletes and restores customer', async ({ page }) => {
    const row = customerRow(page, 'paid@example.com');
    const deleteRequest = page.waitForRequest(
      (req) => /\/api\/admin\/customers\/\d+$/.test(req.url()) && req.method() === 'DELETE',
    );

    await row.getByRole('button', { name: 'Delete', exact: true }).click();
    await page.getByRole('dialog', { name: 'Soft-delete customer' }).getByRole('button', { name: 'Delete' }).click();
    await deleteRequest;

    await expect(row).not.toBeVisible({ timeout: 15_000 });

    await page.locator('#admin-show-deleted-customers').check();
    const restoreRequest = page.waitForRequest((req) => req.url().includes('/restore') && req.method() === 'POST');
    await page.getByRole('button', { name: 'Restore' }).click();
    await restoreRequest;

    await page.locator('#admin-show-deleted-customers').uncheck();
    await expect(page.getByText('paid@example.com')).toBeVisible({ timeout: 15_000 });
  });

  test('links customer to orders in history modal', async ({ page }) => {
    await customerRow(page, 'pending@example.com').getByRole('button', { name: 'View History' }).click();
    const modal = customerHistoryModal(page);
    await expect(modal.getByText('#GSS-ADMIN-PENDING')).toBeVisible({ timeout: 15_000 });
    await expect(modal.getByText('$123.00').first()).toBeVisible();
  });

  test('searches customers by email', async ({ page }) => {
    const searchRequest = page.waitForRequest(
      (req) => req.url().includes('/api/admin/customers') && req.url().includes('search=paid') && req.method() === 'GET',
    );

    await page.locator('#admin-customer-search').fill('paid@example.com');
    await searchRequest;

    await expect(page.getByText('paid@example.com')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('pending@example.com')).not.toBeVisible();
  });
});
