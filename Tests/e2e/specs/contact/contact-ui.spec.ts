import { test, expect } from '../../fixtures/storefront';

test.describe('Contact UI', () => {
  test('renders contact form fields', async ({ page }) => {
    await page.goto('/contact');
    await expect(page.getByRole('heading', { name: 'Contact Us' })).toBeVisible();
    await expect(page.getByTestId('contact-support-whatsapp')).toHaveAttribute(
      'href',
      expect.stringMatching(/^https:\/\/wa\.me\/\d+/),
    );
    await expect(page.locator('input[name="name"]')).toBeVisible();
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('input[name="subject"]')).toBeVisible();
    await expect(page.locator('textarea[name="message"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Send Message' })).toBeVisible();
  });

  test('opens WhatsApp with prefilled message on submit', async ({ page }) => {
    await page.goto('/contact');
    await page.locator('input[name="name"]').fill('Playwright Tester');
    await page.locator('input[name="email"]').fill('tester@example.com');
    await page.locator('input[name="subject"]').fill('UI test inquiry');
    await page.locator('textarea[name="message"]').fill('Automated Playwright contact form test.');

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Send Message' }).click(),
    ]);

    expect(popup.url()).toMatch(/^https:\/\/wa\.me\/\d+\?text=/);
    const decoded = decodeURIComponent(popup.url().split('?text=')[1] ?? '');
    expect(decoded).toContain('New Contact Form Submission');
    expect(decoded).toContain('Playwright Tester');
    expect(decoded).toContain('tester@example.com');
    expect(decoded).toContain('UI test inquiry');
    expect(decoded).toContain('Automated Playwright contact form test.');

    await expect(page.getByRole('button', { name: 'Sent!' })).toBeVisible({ timeout: 10_000 });
  });
});
