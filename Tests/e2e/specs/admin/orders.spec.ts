import { test, expect } from '../../fixtures/admin';
import {
  loginToAdminDashboard,
  openAdminTab,
  openOrderModal,
  closeOrderModal,
  orderModal,
} from '../../helpers/admin-modules';

test.describe('Admin Orders module', () => {
  test.beforeEach(async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Orders');
  });

  test('loads orders list with seeded orders', async ({ page }) => {
    await expect(page.getByText('#GSS-ADMIN-PENDING')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('#GSS-ADMIN-PROCESSING')).toBeVisible();
  });

  test('filters orders by payment status', async ({ page }) => {
    const filterRequest = page.waitForRequest(
      (req) => req.url().includes('/api/orders') && req.url().includes('status=pending') && req.method() === 'GET',
    );

    await page.locator('#admin-order-status-filter').selectOption('pending');
    await filterRequest;

    await expect(page.getByText('#GSS-ADMIN-PENDING')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('#GSS-ADMIN-PROCESSING')).not.toBeVisible();
  });

  test('searches orders by customer email', async ({ page }) => {
    const searchRequest = page.waitForRequest(
      (req) => req.url().includes('/api/orders') && req.url().includes('search=paid') && req.method() === 'GET',
    );

    await page.locator('#admin-order-search').fill('paid@example.com');
    await searchRequest;

    await expect(page.getByText('#GSS-ADMIN-PROCESSING')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('#GSS-ADMIN-PENDING')).not.toBeVisible();
  });

  test('opens order modal and validates customer, items, pricing, and status', async ({ page }) => {
    await page.getByRole('button', { name: 'View order details' }).first().click();
    const modal = orderModal(page);

    await expect(modal.getByRole('heading', { name: '#GSS-ADMIN-PENDING' })).toBeVisible();
    await expect(modal.getByText('pending', { exact: true }).first()).toBeVisible();
    await expect(modal.getByText('Pending Buyer')).toBeVisible();
    await expect(modal.getByText('pending@example.com')).toBeVisible();
    await expect(modal.getByText('Nike Drops - Blue')).toBeVisible();
    await expect(modal.getByText('Subtotal')).toBeVisible();
    await expect(modal.getByText('$98.00').first()).toBeVisible();
    await expect(modal.getByText('$123.00').first()).toBeVisible();
  });

  test('closes order modal and resets UI state', async ({ page }) => {
    await openOrderModal(page, 'GSS-ADMIN-PENDING');
    await closeOrderModal(page);
    await expect(page.getByLabel('Orders', { exact: true })).toBeVisible();
    await expect(orderModal(page)).not.toBeVisible();
  });

  test('saves tracking details via PUT /api/orders/:id', async ({ page }) => {
    await openOrderModal(page, 'GSS-ADMIN-PENDING');

    const updateRequest = page.waitForRequest(
      (req) => /\/api\/orders\/[^/]+$/.test(req.url()) && req.method() === 'PUT',
    );

    await page.locator('#admin-order-tracking-number').fill('1Z-PLAYWRIGHT');
    await page.locator('#admin-order-carrier').fill('UPS');
    await page.getByRole('button', { name: 'Save tracking' }).click();

    const req = await updateRequest;
    const body = req.postDataJSON() as { tracking_number: string; carrier: string };
    expect(body.tracking_number).toBe('1Z-PLAYWRIGHT');
    expect(body.carrier).toBe('UPS');
    await expect(page.getByText('Tracking saved')).toBeVisible({ timeout: 10_000 });
  });

  test('marks pending order paid via PATCH payment-status', async ({ page }) => {
    await openOrderModal(page, 'GSS-ADMIN-PENDING');
    await page.getByRole('button', { name: 'Mark paid' }).click();

    const markPaidRequest = page.waitForRequest(
      (req) => req.url().includes('/payment-status') && req.method() === 'PATCH',
    );

    await page.locator('#admin-dialog-primary').fill('UPI-PLAYWRIGHT-001');
    await page.locator('#admin-dialog-secondary').fill('Confirmed on WhatsApp');
    await page.getByRole('button', { name: 'Mark paid' }).last().click();

    const req = await markPaidRequest;
    expect((req.postDataJSON() as { payment_id: string }).payment_id).toBe('UPI-PLAYWRIGHT-001');
    await expect(page.getByText('Payment marked completed')).toBeVisible({ timeout: 15_000 });
  });

  test('updates customer details on pending order via PATCH customer-details', async ({ page }) => {
    await openOrderModal(page, 'GSS-ADMIN-PENDING');
    await page.getByRole('button', { name: 'Edit details' }).click();

    const patchRequest = page.waitForRequest(
      (req) => req.url().includes('/customer-details') && req.method() === 'PATCH',
    );

    await page.locator('#admin-order-customer-name').fill('Updated Pending Name');
    await page.locator('#admin-order-customer-city').fill('Chicago');
    await page.getByRole('button', { name: 'Save customer details' }).click();

    await patchRequest;
    await expect(orderModal(page).getByText('Updated Pending Name')).toBeVisible({ timeout: 15_000 });
  });

  test('advances order status to processing after mark paid', async ({ page }) => {
    await openOrderModal(page, 'GSS-ADMIN-PENDING');
    await page.getByRole('button', { name: 'Mark paid' }).click();
    await page.locator('#admin-dialog-primary').fill('UPI-REF-002');
    await page.locator('#admin-dialog-secondary').fill('Manual confirmation');
    await page.getByRole('button', { name: 'Mark paid' }).last().click();

    await expect(orderModal(page).getByText('processing', { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(orderModal(page).getByText('completed', { exact: true })).toBeVisible();
  });
});
