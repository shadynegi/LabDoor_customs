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

  test('opens WhatsApp with prefilled message on submit', async ({ page, context }) => {
    await page.goto('/contact');
    await page.locator('input[name="name"]').fill('Playwright Tester');
    await page.locator('input[name="email"]').fill('tester@example.com');
    await page.locator('input[name="subject"]').fill('UI test inquiry');
    await page.locator('textarea[name="message"]').fill('Automated Playwright contact form test.');

    // Intercept window.open so the popup stays in the same context and doesn't steal focus
    const popupPromise = context.waitForEvent('page');
    await page.getByRole('button', { name: 'Send Message' }).click();
    const popup = await popupPromise;

    // Button state changes synchronously — check it before the popup navigates
    await expect(page.getByRole('button', { name: 'Sent!' })).toBeVisible({ timeout: 10_000 });

    // Verify the WhatsApp URL was opened with the right content
    // Wait for popup to navigate (may redirect wa.me → api.whatsapp.com)
    await popup.waitForURL(/wa\.me|whatsapp\.com/, { timeout: 15_000 }).catch(() => {});
    const popupUrl = popup.url();
    expect(popupUrl).toMatch(/wa\.me\/\d+|api\.whatsapp\.com\/send|whatsapp\.com/);
    const rawText = popupUrl.includes('?text=')
      ? popupUrl.split('?text=')[1]
      : new URL(popupUrl).searchParams.get('text') ?? '';
    const decoded = decodeURIComponent(rawText);
    expect(decoded).toContain('New Contact Form Submission');
    expect(decoded).toContain('Playwright Tester');
    expect(decoded).toContain('tester@example.com');
    expect(decoded).toContain('UI test inquiry');
    expect(decoded).toContain('Automated Playwright contact form test.');
  });
});
