import { test, expect } from '../../fixtures/admin';

async function loginToDashboard(page: import('@playwright/test').Page) {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Username' }).fill('admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('test-password');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/adminshivamdashboard/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
}

test.describe('Admin analytics custom range UI', () => {
  test('disables CSV export until custom range is applied', async ({ page }) => {
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Custom' }).click();
    await expect(page.getByLabel(/^From$/i)).toBeVisible();

    const exportButton = page.getByRole('button', { name: /export csv/i });
    await expect(exportButton).toBeDisabled();

    const analyticsRequest = page.waitForRequest(
      (req) => req.url().includes('/admin/analytics?') && req.method() === 'GET',
    );
    await page.getByLabel(/^From$/i).fill('2026-01-01');
    await page.getByLabel(/^To$/i).fill('2026-01-31');
    await page.getByRole('button', { name: 'Apply range' }).click();

    const req = await analyticsRequest;
    expect(req.url()).toContain('period=custom');
    expect(req.url()).toContain('%2B05%3A30');

    await expect(page.getByText('Units Sold')).toBeVisible({ timeout: 15_000 });
    await expect(exportButton).toBeEnabled();
  });

  test('re-disables export when custom dates change after apply', async ({ page }) => {
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Custom' }).click();
    await page.getByLabel(/^From$/i).fill('2026-01-01');
    await page.getByLabel(/^To$/i).fill('2026-01-15');
    await page.getByRole('button', { name: 'Apply range' }).click();
    await expect(page.getByRole('button', { name: /export csv/i })).toBeEnabled({
      timeout: 15_000,
    });

    await page.getByLabel(/^To$/i).fill('2026-01-20');
    await expect(page.getByRole('button', { name: /export csv/i })).toBeDisabled();
  });
});
