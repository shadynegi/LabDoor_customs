import { test, expect } from '@playwright/test';
import { installStorefrontApiMocks } from '../../helpers/mock-api';
import { acceptAllCookies, clearCookieConsent } from '../../helpers/ui';

test.describe('Cookie consent UI', () => {
  test.beforeEach(async ({ page }) => {
    await installStorefrontApiMocks(page);
    await clearCookieConsent(page);
  });

  test('shows banner and hides after accept all', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByText('Cookie Settings')).toBeVisible({ timeout: 5000 });
    await acceptAllCookies(page);
    await expect(page.getByText('Cookie Settings')).toBeHidden();
  });

  test('reject non-essential stores essential-only consent', async ({ page }) => {
    await page.goto('/products');
    await page.getByRole('button', { name: 'Reject non-essential cookies' }).click({ timeout: 5000 });
    await expect(page.getByText('Cookie Settings')).toBeHidden({ timeout: 5000 });

    const prefs = await page.evaluate(() =>
      localStorage.getItem('lab_door_cookie_preferences'),
    );
    expect(prefs).toContain('"analytics":false');
    expect(prefs).toContain('"essential":true');
  });
});
