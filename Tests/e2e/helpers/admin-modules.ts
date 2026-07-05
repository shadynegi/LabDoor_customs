import { expect, type Page } from '@playwright/test';
import {
  loginToAdminDashboard,
  openAdminTab,
  type AdminTab,
} from './admin-dashboard';

export type { AdminTab };
export { loginToAdminDashboard, openAdminTab };

export interface ProductFormInput {
  name?: string;
  price?: string;
  stock?: string;
  image?: string;
  description?: string;
}

export async function openCreateProductForm(page: Page) {
  await page.getByRole('button', { name: /Add Shoe/i }).click();
  await expect(page.getByRole('heading', { name: 'Add New Shoe' })).toBeVisible();
}

export async function openEditProductForm(page: Page, productName: string) {
  const row = page.locator('tr', { hasText: productName });
  await row.getByRole('button', { name: 'Edit product' }).click();
  await expect(page.getByRole('heading', { name: 'Edit Product' })).toBeVisible();
}

export async function fillProductForm(page: Page, data: ProductFormInput) {
  if (data.name != null) await page.locator('#admin-product-name').fill(data.name);
  if (data.price != null) await page.locator('#admin-product-price').fill(data.price);
  if (data.stock != null) await page.locator('#admin-product-stock').fill(data.stock);
  if (data.image != null) await page.locator('#admin-product-image').fill(data.image);
  if (data.description != null) await page.locator('#admin-product-description').fill(data.description);
}

export async function submitProductForm(page: Page, mode: 'create' | 'edit') {
  const label = mode === 'create' ? 'Create Product' : 'Save Changes';
  await page.getByRole('button', { name: label }).click();
}

export function productRow(page: Page, name: string) {
  return page.locator('tr', { hasText: name });
}

export function couponRow(page: Page, code: string) {
  return page.locator('tr', { hasText: code });
}

export function customerRow(page: Page, email: string) {
  return page.locator('tr', { hasText: email });
}

export function orderModal(page: Page) {
  return page.getByLabel('Order details', { exact: true });
}

export async function openOrderModal(page: Page, orderNumber: string) {
  await page.getByText(`#${orderNumber}`).click();
  await expect(orderModal(page)).toBeVisible();
}

export async function closeOrderModal(page: Page) {
  await orderModal(page).getByRole('button', { name: 'Close' }).click();
  await expect(orderModal(page)).not.toBeVisible();
}

export function customerHistoryModal(page: Page) {
  return page.getByLabel('Customer history', { exact: true });
}

export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible({ timeout: 10_000 });
}

export async function createCoupon(page: Page, code: string, percent: string) {
  await page.locator('#admin-coupon-custom-code').fill(code);
  await page.locator('#admin-coupon-custom-percent').selectOption(percent);
  await page.locator('#admin-tabpanel-coupons').getByRole('button', { name: 'Create' }).click();
}
