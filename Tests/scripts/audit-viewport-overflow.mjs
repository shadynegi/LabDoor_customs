/**
 * Quick overflow audit across breakpoints and storefront routes.
 * Usage: node Tests/scripts/audit-viewport-overflow.mjs
 * Requires: frontend built + preview on 4173 (or set PREVIEW_URL).
 */
import { chromium } from 'playwright';

const BASE = process.env.PREVIEW_URL || 'http://127.0.0.1:4173';
const WIDTHS = [320, 360, 375, 390, 412, 430, 480, 540, 600, 768, 820, 1024];
const ROUTES = [
  '/',
  '/products',
  '/about',
  '/contact',
  '/help',
  '/privacy-policy',
  '/terms-of-service',
  '/replacement-policy',
  '/shipping-policy',
  '/orders',
  '/admin/login',
  '/payment/success',
  '/payment/cancel',
  '/product/1',
  '/cart',
  '/checkout',
];

const failures = [];

async function check(page, route, width) {
  await page.setViewportSize({ width, height: 844 });
  await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(400);
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  if (scrollWidth > clientWidth + 2) {
    failures.push({ route, width, scrollWidth, clientWidth, overflow: scrollWidth - clientWidth });
  }
}

const browser = await chromium.launch();
const page = await browser.newPage();

for (const width of WIDTHS) {
  for (const route of ROUTES) {
    try {
      await check(page, route, width);
    } catch (err) {
      failures.push({ route, width, error: String(err) });
    }
  }
}

await browser.close();

if (failures.length === 0) {
  console.log(`audit-viewport-overflow: OK (${WIDTHS.length} widths × ${ROUTES.length} routes)`);
  process.exit(0);
}

console.log(`audit-viewport-overflow: ${failures.length} issue(s)`);
for (const f of failures) {
  console.log(JSON.stringify(f));
}
process.exit(1);
