import { test, expect } from '../../fixtures/admin';
import { assertNoHorizontalOverflow } from '../../helpers/responsive';
import { POPULAR_MOBILE_VIEWPORTS } from '../../helpers/viewports';

const ADMIN_KEY = 'ldc_admin_theme';
const STOREFRONT_KEY = 'ldc_storefront_theme';

// ── seed helpers ──────────────────────────────────────────────────────────────

async function setAdminTheme(
  page: import('@playwright/test').Page,
  theme: 'light' | 'dark',
): Promise<void> {
  await page.addInitScript(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: ADMIN_KEY, v: theme },
  );
}

async function loginToDashboard(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/admin/login');
  await page.getByRole('textbox', { name: 'Username' }).fill('admin');
  await page.getByRole('textbox', { name: 'Password' }).fill('test-password');
  await page.locator('form button[type="submit"]').click();
  await expect(page).toHaveURL(/\/adminshivamdashboard/, { timeout: 15_000 });
  await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible();
}

async function getAdminRootTheme(page: import('@playwright/test').Page): Promise<string | null | undefined> {
  return page.evaluate(() => {
    const el = document.querySelector('.admin-root') as HTMLElement | null;
    return el ? el.dataset.adminTheme : undefined;
  });
}

async function getHtmlTheme(page: import('@playwright/test').Page): Promise<string | undefined> {
  return page.evaluate(() => document.documentElement.dataset.theme);
}

async function getStoredTheme(
  page: import('@playwright/test').Page,
  key: string,
): Promise<string | null> {
  return page.evaluate((k) => localStorage.getItem(k), key);
}

// ── presence ──────────────────────────────────────────────────────────────────

test.describe('Admin dark mode toggle — presence', () => {
  test.describe.configure({ mode: 'serial' });

  test('toggle button visible on /admin/login', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeVisible();
  });

  test('toggle button visible on /adminshivamdashboard after login', async ({ page }) => {
    await loginToDashboard(page);
    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeVisible();
  });
});

// ── toggle functionality ──────────────────────────────────────────────────────

test.describe('Admin dark mode toggle — functionality', () => {
  test.describe.configure({ mode: 'serial' });

  test('click sets data-admin-theme="dark" on .admin-root on login page', async ({ page }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    expect(await getAdminRootTheme(page)).toBe('dark');
  });

  test('click sets data-admin-theme="dark" on .admin-root on dashboard', async ({ page }) => {
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    expect(await getAdminRootTheme(page)).toBe('dark');
  });

  test('second click returns data-admin-theme to "light" on dashboard', async ({ page }) => {
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to light mode' }).click();

    expect(await getAdminRootTheme(page)).toBe('light');
  });

  test('aria-label becomes "Switch to light mode" after enabling dark on dashboard', async ({ page }) => {
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  });

  test('aria-label becomes "Switch to dark mode" after disabling dark on dashboard', async ({ page }) => {
    await setAdminTheme(page, 'dark');
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  });
});

// ── persistence ───────────────────────────────────────────────────────────────

test.describe('Admin dark mode — persistence', () => {
  test.describe.configure({ mode: 'serial' });

  test('dark preference persists after dashboard reload', async ({ page }) => {
    await setAdminTheme(page, 'dark');
    await loginToDashboard(page);

    expect(await getAdminRootTheme(page)).toBe('dark');
  });

  test('light preference persists after dashboard reload', async ({ page }) => {
    await setAdminTheme(page, 'light');
    await loginToDashboard(page);

    expect(await getAdminRootTheme(page)).toBe('light');
  });

  test('toggling dark writes ldc_admin_theme="dark" to localStorage', async ({ page }) => {
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    expect(await getStoredTheme(page, ADMIN_KEY)).toBe('dark');
  });

  test('toggling back to light writes ldc_admin_theme="light" to localStorage', async ({ page }) => {
    await setAdminTheme(page, 'dark');
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Switch to light mode' }).click();

    expect(await getStoredTheme(page, ADMIN_KEY)).toBe('light');
  });

  test('dark preference persists on login page from localStorage', async ({ page }) => {
    await setAdminTheme(page, 'dark');
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible({ timeout: 15_000 });

    expect(await getAdminRootTheme(page)).toBe('dark');
  });
});

// ── scope isolation ───────────────────────────────────────────────────────────

test.describe('Admin dark mode — scope isolation from storefront', () => {
  test.describe.configure({ mode: 'serial' });

  test('admin toggle does NOT set data-theme on <html>', async ({ page }) => {
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    // <html> data-theme must be untouched — admin scope is .admin-root only
    const htmlTheme = await getHtmlTheme(page);
    expect(htmlTheme).not.toBe('dark');
  });

  test('admin toggle does not flip ldc_storefront_theme to dark', async ({ page }) => {
    await loginToDashboard(page);

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    // The storefront provider wraps the whole app and writes its own key at its
    // default ('light') on every route, admin included. The isolation guarantee
    // is that the admin toggle never turns the storefront theme dark.
    expect(await getStoredTheme(page, STOREFRONT_KEY)).not.toBe('dark');
  });

  test('storefront dark preference does not affect .admin-root data-admin-theme', async ({ page }) => {
    await page.addInitScript(
      ({ sk, ak }) => {
        localStorage.setItem(sk, 'dark');
        localStorage.setItem(ak, 'light');
      },
      { sk: STOREFRONT_KEY, ak: ADMIN_KEY },
    );
    await loginToDashboard(page);

    expect(await getAdminRootTheme(page)).toBe('light');
  });

  test('.admin-root element exists and is distinct from <html>', async ({ page }) => {
    await loginToDashboard(page);

    const isDistinct = await page.evaluate(() => {
      const root = document.querySelector('.admin-root');
      return root !== null && root !== document.documentElement;
    });
    expect(isDistinct).toBe(true);
  });
});

// ── CSS token application ─────────────────────────────────────────────────────

test.describe('Admin dark mode — CSS token values', () => {
  test.describe.configure({ mode: 'serial' });

  test('--color-bg-base differs between light and dark on dashboard', async ({ page }) => {
    await setAdminTheme(page, 'light');
    await loginToDashboard(page);

    const lightBg = await page.evaluate(() => {
      const el = document.querySelector('.admin-root') as HTMLElement;
      return getComputedStyle(el).getPropertyValue('--color-bg-base').trim();
    });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    const darkBg = await page.evaluate(() => {
      const el = document.querySelector('.admin-root') as HTMLElement;
      return getComputedStyle(el).getPropertyValue('--color-bg-base').trim();
    });

    expect(lightBg).not.toBe('');
    expect(darkBg).not.toBe('');
    expect(lightBg).not.toBe(darkBg);
  });

  test('--color-text-primary differs between light and dark on login page', async ({ page }) => {
    await setAdminTheme(page, 'light');
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible({ timeout: 15_000 });

    const lightText = await page.evaluate(() => {
      const el = document.querySelector('.admin-root') as HTMLElement;
      return getComputedStyle(el).getPropertyValue('--color-text-primary').trim();
    });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    const darkText = await page.evaluate(() => {
      const el = document.querySelector('.admin-root') as HTMLElement;
      return getComputedStyle(el).getPropertyValue('--color-text-primary').trim();
    });

    expect(lightText).not.toBe(darkText);
  });
});

// ── touch target ──────────────────────────────────────────────────────────────

test.describe('Admin dark mode toggle — touch target size', () => {
  test.describe.configure({ mode: 'serial' });

  for (const device of POPULAR_MOBILE_VIEWPORTS) {
    test(`toggle ≥ 44×44px on ${device.label} — /admin/login`, async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/admin/login');
      await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible({ timeout: 15_000 });

      const btn = page.getByRole('button', { name: /switch to (dark|light) mode/i });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box, `bounding box missing on ${device.label}`).not.toBeNull();
      // Allow a sub-pixel tolerance: a true 44px CSS box can round to 43.9999
      // when Playwright converts through the device pixel ratio.
      expect(box!.width, `width < 44px on ${device.label}`).toBeGreaterThanOrEqual(43.5);
      expect(box!.height, `height < 44px on ${device.label}`).toBeGreaterThanOrEqual(43.5);
    });
  }
});

// ── mobile overflow ───────────────────────────────────────────────────────────

test.describe('Admin dark mode toggle — no horizontal overflow on mobile', () => {
  for (const device of POPULAR_MOBILE_VIEWPORTS.filter((d) => d.viewport.width <= 412)) {
    test(`no overflow on /admin/login with toggle — ${device.label}`, async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/admin/login');
      await expect(page.getByRole('heading', { name: 'Admin Portal' })).toBeVisible({ timeout: 15_000 });
      await assertNoHorizontalOverflow(page, `${device.label} /admin/login with dark mode toggle`);
    });
  }
});
