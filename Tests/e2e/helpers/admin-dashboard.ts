import { expect, type Page } from '@playwright/test';

export type AdminTab = 'Analytics' | 'Products' | 'Orders' | 'Coupons' | 'Customers' | 'Settings';

export async function loginToAdminDashboard(page: Page) {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Username' }).fill('admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('test-password');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/adminshivamdashboard/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
}

export async function openAdminTab(page: Page, tab: AdminTab) {
  await page.getByRole('tab', { name: tab }).click();
  await expect(page.getByRole('tab', { name: tab })).toHaveAttribute('aria-selected', 'true');
}
