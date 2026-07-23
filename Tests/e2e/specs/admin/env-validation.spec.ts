import { test, expect } from '../../fixtures/admin';
import { loginToAdminDashboard } from '../../helpers/admin-modules';

test.describe('Admin environment validation', () => {
  test('serves admin login and dashboard on preview host', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
    await loginToAdminDashboard(page);
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
  });

  test('mocked analytics API returns expected dashboard shape after login', async ({ page }) => {
    // Register listener before login so we catch the analytics request that fires on dashboard load.
    const analyticsResponsePromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/admin/analytics') && resp.request().method() === 'GET',
    );
    await loginToAdminDashboard(page);

    const analyticsResponse = await analyticsResponsePromise;
    const body = (await analyticsResponse.json()) as {
      success: boolean;
      data: { orders: { total_orders: number }; products: { total_products: number } };
    };

    expect(body.success).toBe(true);
    expect(body.data.orders.total_orders).toBeGreaterThan(0);
    expect(body.data.products.total_products).toBeGreaterThan(0);
    await expect(page.getByText('Total Orders')).toBeVisible();
  });

  test('contact page exposes WhatsApp link from build-time env', async ({ page }) => {
    await page.goto('/contact');
    const whatsappLink = page.getByTestId('contact-support-whatsapp');
    await expect(whatsappLink).toBeVisible({ timeout: 15_000 });
    await expect(whatsappLink).toHaveAttribute('href', /wa\.me/);
  });

  test('CSRF token endpoint is reachable for authenticated flows', async ({ page }) => {
    await page.goto('/');
    const response = await page.waitForResponse(
      (resp) => resp.url().includes('/api/csrf-token') && resp.request().method() === 'GET',
    );
    const body = (await response.json()) as { success: boolean; csrfToken: string };
    expect(body.success).toBe(true);
    expect(body.csrfToken.length).toBeGreaterThan(0);
  });
});
