import type { Page } from '@playwright/test';

/** Fill minimal checkout customer fields for PayPal redirect tests. */
export async function fillCheckoutCustomerForm(page: Page): Promise<void> {
  await page.getByLabel(/full name/i).fill('Playwright Buyer');
  await page.getByLabel(/email/i).first().fill('buyer@example.com');
  await page.getByLabel(/phone/i).fill('5551234567');
  await page.getByLabel(/street address/i).fill('123 Test Street');
  await page.getByLabel(/city/i).fill('New York');
  await page.getByLabel(/state \/ province/i).fill('NY');
  await page.getByLabel(/zip \/ postal code/i).fill('10001');
}
