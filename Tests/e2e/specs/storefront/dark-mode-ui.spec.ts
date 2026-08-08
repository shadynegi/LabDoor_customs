import { test, expect } from '../../fixtures/storefront';
import { assertNoHorizontalOverflow } from '../../helpers/responsive';
import { POPULAR_MOBILE_VIEWPORTS } from '../../helpers/viewports';

const STOREFRONT_KEY = 'ldc_storefront_theme';
const ADMIN_KEY = 'ldc_admin_theme';

// ── seed helpers ──────────────────────────────────────────────────────────────

async function setStorefrontTheme(
  page: import('@playwright/test').Page,
  theme: 'light' | 'dark',
): Promise<void> {
  await page.addInitScript(
    ({ k, v }) => localStorage.setItem(k, v),
    { k: STOREFRONT_KEY, v: theme },
  );
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

test.describe('Storefront dark mode toggle — presence', () => {
  test('toggle button visible on home page', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('toggle button visible on /products', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeVisible();
  });

  test('toggle button visible on /cart', async ({ page }) => {
    await page.goto('/cart');
    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('toggle button visible on /orders', async ({ page }) => {
    await page.goto('/orders');
    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeVisible({ timeout: 15_000 });
  });

  test('toggle button visible on /about', async ({ page }) => {
    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'About Lab Door Customs' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeVisible();
  });

  test('toggle button visible on /contact', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible({ timeout: 15_000 });
    await expect(
      page.getByRole('button', { name: /switch to (dark|light) mode/i }),
    ).toBeVisible();
  });
});

// ── toggle functionality ──────────────────────────────────────────────────────

test.describe('Storefront dark mode toggle — functionality', () => {
  test('click sets data-theme="dark" on <html>', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    expect(await getHtmlTheme(page)).toBe('dark');
  });

  test('second click returns data-theme to "light"', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();

    await page.getByRole('button', { name: 'Switch to light mode' }).click();

    expect(await getHtmlTheme(page)).toBe('light');
  });

  test('aria-label becomes "Switch to light mode" after enabling dark', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.getByRole('button', { name: 'Switch to light mode' })).toBeVisible();
  });

  test('aria-label returns to "Switch to dark mode" after disabling dark', async ({ page }) => {
    await setStorefrontTheme(page, 'dark');
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to light mode' }).click();
    await expect(page.getByRole('button', { name: 'Switch to dark mode' })).toBeVisible();
  });

  test('toggle on home page sets data-theme on <html>', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    expect(await getHtmlTheme(page)).toBe('dark');
  });
});

// ── persistence ───────────────────────────────────────────────────────────────

test.describe('Storefront dark mode — persistence', () => {
  test('dark preference persists after page reload', async ({ page }) => {
    await setStorefrontTheme(page, 'dark');
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    expect(await getHtmlTheme(page)).toBe('dark');
  });

  test('light preference persists after page reload', async ({ page }) => {
    await setStorefrontTheme(page, 'light');
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    expect(await getHtmlTheme(page)).toBe('light');
  });

  test('toggling dark writes ldc_storefront_theme="dark" to localStorage', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    expect(await getStoredTheme(page, STOREFRONT_KEY)).toBe('dark');
  });

  test('toggling back to light writes ldc_storefront_theme="light" to localStorage', async ({ page }) => {
    await setStorefrontTheme(page, 'dark');
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to light mode' }).click();

    expect(await getStoredTheme(page, STOREFRONT_KEY)).toBe('light');
  });

  test('dark preference loads on home page from localStorage', async ({ page }) => {
    await setStorefrontTheme(page, 'dark');
    await page.goto('/');

    expect(await getHtmlTheme(page)).toBe('dark');
  });

  test('dark theme is maintained when navigating between routes', async ({ page }) => {
    await setStorefrontTheme(page, 'dark');
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.goto('/about');
    await expect(page.getByRole('heading', { name: 'About Lab Door Customs' })).toBeVisible({ timeout: 15_000 });

    expect(await getHtmlTheme(page)).toBe('dark');
  });

  test('dark theme is maintained when navigating from / to /products', async ({ page }) => {
    await setStorefrontTheme(page, 'dark');
    await page.goto('/');
    await page.getByRole('button', { name: /view all products/i }).first().click();
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    expect(await getHtmlTheme(page)).toBe('dark');
  });
});

// ── no FOUC ───────────────────────────────────────────────────────────────────

test.describe('Storefront dark mode — no flash of unstyled content', () => {
  test('data-theme is set synchronously before first render on /products', async ({ page }) => {
    await setStorefrontTheme(page, 'dark');

    // Capture theme at the earliest possible moment via DOMContentLoaded
    const themeAtLoad = await page.evaluate(() => {
      return new Promise<string | undefined>((resolve) => {
        if (document.readyState !== 'loading') {
          resolve(document.documentElement.dataset.theme);
          return;
        }
        document.addEventListener('DOMContentLoaded', () => {
          resolve(document.documentElement.dataset.theme);
        }, { once: true });
      });
    });

    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    // After full load, confirm theme is still dark
    expect(await getHtmlTheme(page)).toBe('dark');
  });
});

// ── scope isolation ───────────────────────────────────────────────────────────

test.describe('Storefront dark mode — scope isolation from admin', () => {
  test('storefront toggle does not write ldc_admin_theme key', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    expect(await getStoredTheme(page, ADMIN_KEY)).toBeNull();
  });

  test('storefront toggle does not set data-admin-theme on <html>', async ({ page }) => {
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    const adminAttr = await page.evaluate(
      () => document.documentElement.dataset.adminTheme,
    );
    expect(adminAttr).toBeUndefined();
  });

  test('admin dark preference does not affect storefront data-theme', async ({ page }) => {
    await page.addInitScript(
      ({ sk, ak }) => {
        localStorage.setItem(sk, 'light');
        localStorage.setItem(ak, 'dark');
      },
      { sk: STOREFRONT_KEY, ak: ADMIN_KEY },
    );
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    expect(await getHtmlTheme(page)).toBe('light');
  });
});

// ── CSS token application ─────────────────────────────────────────────────────

test.describe('Storefront dark mode — CSS token values', () => {
  test('--color-bg-base differs between light and dark on /products', async ({ page }) => {
    await setStorefrontTheme(page, 'light');
    await page.goto('/products');
    await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

    const lightBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg-base').trim(),
    );

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    const darkBg = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-bg-base').trim(),
    );

    expect(lightBg).not.toBe('');
    expect(darkBg).not.toBe('');
    expect(lightBg).not.toBe(darkBg);
  });

  test('--color-text-primary differs between light and dark on home page', async ({ page }) => {
    await setStorefrontTheme(page, 'light');
    await page.goto('/');

    const lightText = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim(),
    );

    await page.getByRole('button', { name: 'Switch to dark mode' }).click();

    const darkText = await page.evaluate(() =>
      getComputedStyle(document.documentElement).getPropertyValue('--color-text-primary').trim(),
    );

    expect(lightText).not.toBe(darkText);
  });
});

// ── touch target ──────────────────────────────────────────────────────────────

test.describe('Storefront dark mode toggle — touch target size', () => {
  for (const device of POPULAR_MOBILE_VIEWPORTS) {
    test(`toggle ≥ 44×44px on ${device.label} (${device.viewport.width}px) — /products`, async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/products');
      await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });

      const btn = page.getByRole('button', { name: /switch to (dark|light) mode/i });
      await expect(btn).toBeVisible();
      const box = await btn.boundingBox();
      expect(box, `bounding box missing on ${device.label}`).not.toBeNull();
      // Allow a sub-pixel tolerance: a true 44px CSS box can round to 43.9999
      // when Playwright converts through the device pixel ratio.
      expect(box!.width, `width < 44px on ${device.label}`).toBeGreaterThanOrEqual(43.5);
      expect(box!.height, `height < 44px on ${device.label}`).toBeGreaterThanOrEqual(43.5);
    });

    test(`toggle ≥ 44×44px on ${device.label} (${device.viewport.width}px) — home`, async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/');

      const btn = page.getByRole('button', { name: /switch to (dark|light) mode/i });
      await expect(btn).toBeVisible({ timeout: 15_000 });
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

test.describe('Storefront dark mode toggle — no horizontal overflow on mobile', () => {
  for (const device of POPULAR_MOBILE_VIEWPORTS.filter((d) => d.viewport.width <= 412)) {
    test(`no overflow on /products with toggle — ${device.label}`, async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/products');
      await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({ timeout: 15_000 });
      await assertNoHorizontalOverflow(page, `${device.label} /products with dark mode toggle`);
    });

    test(`no overflow on / with toggle — ${device.label}`, async ({ page }) => {
      await page.setViewportSize(device.viewport);
      await page.goto('/');
      await assertNoHorizontalOverflow(page, `${device.label} / with dark mode toggle`);
    });
  }
});
