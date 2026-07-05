import { test, expect } from '../../fixtures/admin';
import { loginToAdminDashboard, openAdminTab, expectToast } from '../../helpers/admin-modules';

test.describe('Admin Settings module', () => {
  test.beforeEach(async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Settings');
  });

  test('exports activity log with date range query params', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Activity log export' })).toBeVisible();

    await page.locator('#admin-activity-export-start').fill('2026-06-01');
    await page.locator('#admin-activity-export-end').fill('2026-06-30');

    const exportRequest = page.waitForRequest(
      (req) => req.url().includes('/api/activity/export') && req.method() === 'GET',
    );

    await page.getByRole('button', { name: 'Export activity log' }).click();
    const req = await exportRequest;
    expect(req.url()).toContain('startDate=');
    expect(req.url()).toContain('endDate=');
  });

  test('loads admin sessions table and runs cleanup', async ({ page }) => {
    await expect(page.getByRole('cell', { name: 'admin' })).toBeVisible({ timeout: 15_000 });

    const cleanupRequest = page.waitForRequest(
      (req) => req.url().includes('/api/admin/sessions/cleanup') && req.method() === 'POST',
    );

    await page.getByRole('button', { name: /Clean up expired/i }).click();
    await cleanupRequest;
    await expectToast(page, /Removed 0 expired session/i);
  });

  test('recomputes customer aggregates from completed orders', async ({ page }) => {
    const recomputeRequest = page.waitForRequest(
      (req) => req.url().includes('/api/admin/customers/recompute') && req.method() === 'POST',
    );

    await page.getByRole('button', { name: /Recompute customer aggregates/i }).click();
    await recomputeRequest;
    await expectToast(page, 'Customer aggregates recomputed');
  });

  test('WhatsApp and payment API settings are environment-driven (not editable in Settings UI)', async ({ page }) => {
    await expect(page.getByText('Activity log export')).toBeVisible();
    await expect(page.getByText('Admin sessions')).toBeVisible();
    await expect(page.getByLabel(/whatsapp/i)).not.toBeVisible();
    await expect(page.getByLabel(/payment gateway/i)).not.toBeVisible();
  });

  test('settings operational actions persist across tab navigation', async ({ page }) => {
    await page.getByRole('button', { name: /Recompute customer aggregates/i }).click();
    await expectToast(page, 'Customer aggregates recomputed');

    await openAdminTab(page, 'Customers');
    await expect(page.getByText('pending@example.com')).toBeVisible({ timeout: 15_000 });

    await openAdminTab(page, 'Settings');
    await expect(page.getByRole('heading', { name: 'Activity log export' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'admin' })).toBeVisible();
  });
});
