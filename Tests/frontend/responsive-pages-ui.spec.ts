import { test, expect } from './fixtures/storefront';
import { PRIMARY_MOCK_PRODUCT, TEST_PRODUCT_IDS } from './fixtures/mock-data';
import { seedCart } from './helpers/ui';
import {
  assertHeadingInViewport,
  assertNoHorizontalOverflow,
  assertVisibleAboveStickyRegion,
} from './helpers/responsive';
import {
  POPULAR_MOBILE_VIEWPORTS,
  STOREFRONT_STATIC_PAGES,
  type MobileViewportProfile,
  type StorefrontPageSpec,
} from './helpers/viewports';

async function useDevice(page: import('@playwright/test').Page, device: MobileViewportProfile) {
  await page.setViewportSize(device.viewport);
}

function deviceContext(device: MobileViewportProfile): string {
  return `${device.label} (${device.viewport.width}×${device.viewport.height})`;
}

async function assertPageReady(
  page: import('@playwright/test').Page,
  pageSpec: StorefrontPageSpec,
  context: string,
): Promise<void> {
  if (pageSpec.heading) {
    const heading = page.getByRole('heading', { name: pageSpec.heading }).first();
    if (pageSpec.scrollReady) {
      await heading.scrollIntoViewIfNeeded();
    }
    await assertHeadingInViewport(page, heading, `${context} ${pageSpec.path}`);
    return;
  }
  const anchor = page.getByText(pageSpec.readyText!).first();
  if (pageSpec.scrollReady) {
    await anchor.scrollIntoViewIfNeeded();
  }
  await expect(anchor).toBeVisible({ timeout: 15_000 });
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  const box = await anchor.boundingBox();
  expect(box, `anchor bbox missing on ${context} ${pageSpec.path}`).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 2);
}

for (const device of POPULAR_MOBILE_VIEWPORTS) {
  const ctx = deviceContext(device);

  test.describe(`Responsive pages — ${device.label}`, () => {
    test.beforeEach(async ({ page }) => {
      await useDevice(page, device);
    });

    for (const pageSpec of STOREFRONT_STATIC_PAGES) {
      test(`${pageSpec.path} fits viewport without horizontal overflow`, async ({ page }) => {
        await page.goto(pageSpec.path);
        await assertPageReady(page, pageSpec, ctx);
        await assertNoHorizontalOverflow(page, `${ctx} ${pageSpec.path}`);
      });
    }

    test('/product/:id fits viewport without horizontal overflow', async ({ page }) => {
      await page.goto(`/product/${TEST_PRODUCT_IDS.nikeBlue}`);
      await expect(page.getByText('Customer Reviews')).toBeVisible({ timeout: 15_000 });
      const heading = page.getByRole('heading', { name: PRIMARY_MOCK_PRODUCT.name });
      await expect(heading).toBeVisible();
      await heading.scrollIntoViewIfNeeded();
      await assertHeadingInViewport(page, heading, `${ctx} product detail`);
      await assertNoHorizontalOverflow(page, `${ctx} product detail`);
    });

    test('/cart sticky checkout bar does not cover policy text', async ({ page }) => {
      const product = PRIMARY_MOCK_PRODUCT;
      await seedCart(page, [
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: 1,
        },
      ]);

      await page.goto('/cart');
      await expect(page.getByRole('heading', { name: 'Your Cart' })).toBeVisible({ timeout: 15_000 });

      const policy = page.getByTestId('cart-policy-notice');
      const sticky = page.getByRole('region', { name: 'Cart checkout actions' });
      await assertVisibleAboveStickyRegion(page, policy, sticky, `${ctx} cart policy`);
      await assertNoHorizontalOverflow(page, `${ctx} cart`);
    });

    test('/checkout form is usable on mobile', async ({ page }) => {
      const product = PRIMARY_MOCK_PRODUCT;
      await seedCart(page, [
        {
          id: product.id,
          name: product.name,
          price: product.price,
          image: product.image,
          quantity: 1,
        },
      ]);

      await page.goto('/checkout');
      const heading = page.getByRole('heading', { name: 'Secure Checkout' });
      await assertHeadingInViewport(page, heading, `${ctx} checkout`);
      await expect(page.getByLabel(/full name/i)).toBeVisible();
      await expect(page.locator('#country-input')).toBeVisible();
      await expect(page.getByRole('checkbox', { name: /all sales are final/i })).toBeVisible();
      await assertNoHorizontalOverflow(page, `${ctx} checkout`);
    });
  });
}

test.describe('Responsive products sort — narrow devices', () => {
  for (const device of POPULAR_MOBILE_VIEWPORTS.filter((d) => d.viewport.width <= 412)) {
    test(`sort control fits on ${device.label}`, async ({ page }) => {
      await useDevice(page, device);
      await page.goto('/products');
      await expect(page.getByRole('heading', { name: 'All Products' })).toBeVisible({
        timeout: 15_000,
      });

      const sortSelect = page.getByLabel('Sort products');
      await expect(sortSelect).toBeVisible();
      await sortSelect.selectOption('price_asc');

      const viewport = page.viewportSize()!;
      const box = await sortSelect.boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 2);
      await assertNoHorizontalOverflow(page, device.label);
    });
  }
});
