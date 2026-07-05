import { test, expect } from '../../fixtures/admin';
import { PRIMARY_MOCK_PRODUCT } from '../../fixtures/mock-data';
import { seedCart } from '../../helpers/ui';
import {
  loginToAdminDashboard,
  openAdminTab,
  openCreateProductForm,
  fillProductForm,
  submitProductForm,
  productRow,
  createCoupon,
  openOrderModal,
  orderModal,
} from '../../helpers/admin-modules';

test.describe('Admin cross-module integration', () => {
  test('created product appears in storefront catalog and order items stay consistent', async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Products');

    await openCreateProductForm(page);
    await fillProductForm(page, {
      name: 'Cross Module Shoe',
      price: '130',
      stock: '6',
      image: '/assets/blue-nike.png',
    });
    await submitProductForm(page, 'create');
    await expect(productRow(page, 'Cross Module Shoe')).toBeVisible({ timeout: 15_000 });

    await page.goto('/');
    await expect(page.getByText('Cross Module Shoe').first()).toBeVisible({ timeout: 15_000 });

    await page.goto('/adminshivamdashboard');
    await expect(page.getByRole('heading', { name: 'Admin Dashboard' })).toBeVisible({ timeout: 15_000 });
    await openAdminTab(page, 'Orders');
    await openOrderModal(page, 'GSS-ADMIN-PENDING');
    await expect(orderModal(page).getByText('Nike Drops - Blue')).toBeVisible();
  });

  test('admin coupon applies discount in checkout totals', async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Coupons');
    await createCoupon(page, 'INTEG20', '20');
    await expect(page.locator('tr', { hasText: 'INTEG20' })).toBeVisible({ timeout: 15_000 });

    const product = PRIMARY_MOCK_PRODUCT;
    await seedCart(page, [
      { id: product.id, name: product.name, price: product.price, image: product.image, quantity: 1 },
    ]);

    await page.goto('/checkout');
    await page.getByPlaceholder('Enter code').fill('INTEG20');
    await page.getByRole('button', { name: 'Apply' }).click();
    await expect(page.getByText('Coupon (INTEG20)')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('-$19.60')).toBeVisible();
  });

  test('deleting product does not break existing order line items', async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Products');

    await openCreateProductForm(page);
    await fillProductForm(page, {
      name: 'Order Legacy Shoe',
      price: '75',
      stock: '2',
      image: '/assets/blue-nike.png',
    });
    await submitProductForm(page, 'create');
    const row = productRow(page, 'Order Legacy Shoe');
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByRole('button', { name: 'Delete product', exact: true }).click();
    await page.getByRole('dialog', { name: 'Delete product' }).getByRole('button', { name: 'Delete' }).click();
    await expect(page.getByText('Order Legacy Shoe')).not.toBeVisible({ timeout: 15_000 });

    await openAdminTab(page, 'Orders');
    await openOrderModal(page, 'GSS-ADMIN-PENDING');
    await expect(orderModal(page).getByText('Nike Drops - Blue')).toBeVisible();
    await expect(orderModal(page).getByText('$123.00')).toBeVisible();
  });

  test('settings recompute keeps customers tab functional', async ({ page }) => {
    await loginToAdminDashboard(page);
    await openAdminTab(page, 'Settings');
    await page.getByRole('button', { name: /Recompute customer aggregates/i }).click();
    await expect(page.getByText('Customer aggregates recomputed')).toBeVisible({ timeout: 10_000 });

    await openAdminTab(page, 'Customers');
    await expect(page.getByText('pending@example.com')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('paid@example.com')).toBeVisible();
  });
});
