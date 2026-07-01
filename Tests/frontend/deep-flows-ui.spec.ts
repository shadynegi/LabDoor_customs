import { test, expect } from './fixtures/storefront';
import { seedCart } from './helpers/ui';
import { PRIMARY_MOCK_PRODUCT, TEST_PRODUCT_IDS } from './fixtures/mock-data';

test.describe('Deep storefront flows', () => {
  test('products?q= filters catalog to matching items', async ({ page }) => {
    await page.goto('/products?q=nike');
    await expect(page.getByText(/Found 1 product for "nike"/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText('Nike Drops - Blue')).toBeVisible();
    await expect(page.getByText('Golden ESSENCE')).not.toBeVisible();
  });

  test('product detail shows no-refund trust badges and replacement policy link', async ({
    page,
  }) => {
    await page.goto(`/product/${TEST_PRODUCT_IDS.nikeBlue}`);
    await expect(page.getByText('All Sales Final')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('link', { name: 'Manufacturing-defect replacements' })).toBeVisible();
    await expect(page.getByText('Free Shipping', { exact: true })).toBeVisible();
    await expect(page.getByText('Secure Payment', { exact: true })).toBeVisible();
  });

  test('product detail lists approved public review', async ({ page }) => {
    await page.goto(`/product/${TEST_PRODUCT_IDS.nikeBlue}`);
    await expect(page.getByText('Customer Reviews')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Alex')).toBeVisible();
    await expect(page.getByText('Great quality')).toBeVisible();
  });

  test('checkout blocks Place Order until no-refund policy is accepted', async ({ page }) => {
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
    await expect(page.getByText('Secure Checkout')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('All sales are final.')).toBeVisible();

    const policyCheckbox = page.getByRole('checkbox', { name: /all sales are final/i });
    await expect(policyCheckbox).not.toBeChecked();

    const placeOrderButton = page.locator('button:visible', { hasText: 'Place Order' });
    await expect(placeOrderButton).toBeDisabled();
  });

  test('checkout applies coupon and shows discount in order summary', async ({ page }) => {
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
    await expect(page.getByText('Secure Checkout')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder('Enter code').fill('LDCOFF10');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText(/10% discount applied/i)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Coupon (LDCOFF10)')).toBeVisible();
    await expect(page.getByText('-$9.80')).toBeVisible();
  });

  test('cart quantity increase updates displayed quantity', async ({ page }) => {
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
    await expect(page.getByText(product.name)).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: `Increase quantity of ${product.name}` }).click();
    await expect(page.locator('text=2').first()).toBeVisible({ timeout: 10_000 });
  });

  test('payment success shows order received confirmation', async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'lastPlacedOrder',
        JSON.stringify({ orderNumber: 'GSS-RECON-TEST', total: 98 }),
      );
    });
    await page.goto('/payment/success');
    await expect(page.getByText('Order received')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Order ID: GSS-RECON-TEST')).toBeVisible();
    await expect(page.getByText('Total: $98.00')).toBeVisible();
  });
});
