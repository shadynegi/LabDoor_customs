import { test, expect } from '../../fixtures/admin';

test.describe('Admin dashboard UI', () => {
  test.describe.configure({ mode: 'serial' });

  test('unauthenticated /admin visit redirects to login', async ({ page }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
  });

  test('unauthenticated dashboard visit redirects to login', async ({ page }) => {
    await page.goto('/adminshivamdashboard');
    await expect(page).toHaveURL(/\/admin\/login/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
  });

  test('authenticated /admin visit redirects to dashboard', async ({ page }) => {
    await page.goto('/admin/login');
    await page.getByRole('textbox', { name: 'Username' }).fill('admin');
    await page.getByRole('textbox', { name: 'Password' }).fill('test-password');
    await page.locator('form button[type="submit"]').click();
    await expect(page).toHaveURL(/\/adminshivamdashboard/, { timeout: 15_000 });

    await page.goto('/admin/');
    await expect(page).toHaveURL(/\/adminshivamdashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });

  test('login redirects to dashboard and shows analytics', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();

    await page.getByRole('textbox', { name: 'Username' }).fill('admin');
    await page.getByRole('textbox', { name: 'Password' }).fill('test-password');
    await page.locator('form button[type="submit"]').click();

    await expect(page).toHaveURL(/\/adminshivamdashboard/, { timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
    await expect(page.getByText('Total Orders')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('12', { exact: true }).first()).toBeVisible();
  });

});
