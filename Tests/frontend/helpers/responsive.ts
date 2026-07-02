import { expect, type Locator, type Page } from '@playwright/test';

const OVERFLOW_TOLERANCE_PX = 2;

/** Fail when document is wider than the viewport (horizontal scroll). */
export async function assertNoHorizontalOverflow(page: Page, context: string): Promise<void> {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(
    scrollWidth,
    `horizontal overflow on ${context} (${scrollWidth}px > ${clientWidth}px)`,
  ).toBeLessThanOrEqual(clientWidth + OVERFLOW_TOLERANCE_PX);
}

/** Primary heading is visible and within the viewport width. */
export async function assertHeadingInViewport(
  page: Page,
  heading: Locator,
  context: string,
): Promise<void> {
  await expect(heading).toBeVisible({ timeout: 15_000 });
  const viewport = page.viewportSize();
  expect(viewport, `missing viewport for ${context}`).not.toBeNull();
  const box = await heading.boundingBox();
  expect(box, `heading bbox missing on ${context}`).not.toBeNull();
  expect(box!.x, `heading off left edge on ${context}`).toBeGreaterThanOrEqual(-OVERFLOW_TOLERANCE_PX);
  expect(
    box!.x + box!.width,
    `heading off right edge on ${context}`,
  ).toBeLessThanOrEqual(viewport!.width + OVERFLOW_TOLERANCE_PX);
}

/** Scroll until content clears a fixed sticky region, then verify layout. */
export async function assertVisibleAboveStickyRegion(
  page: Page,
  content: Locator,
  stickyRegion: Locator,
  context: string,
): Promise<void> {
  await expect(content).toBeVisible();
  await expect(stickyRegion).toBeVisible();

  await content.evaluate((el) => {
    const sticky = document.querySelector('.mobile-sticky-cta');
    if (!sticky) return;
    const gap = 16;
    const stickyTop = sticky.getBoundingClientRect().top;
    const rect = el.getBoundingClientRect();
    const targetScroll = window.scrollY + rect.bottom - (stickyTop - gap);
    window.scrollTo({ top: Math.max(0, targetScroll), behavior: 'instant' });
  });

  await assertAboveStickyRegion(content, stickyRegion, context);
}

async function assertAboveStickyRegion(
  content: Locator,
  stickyRegion: Locator,
  context: string,
): Promise<void> {
  const contentBox = await content.boundingBox();
  const stickyBox = await stickyRegion.boundingBox();
  expect(contentBox, `content bbox missing on ${context}`).not.toBeNull();
  expect(stickyBox, `sticky bbox missing on ${context}`).not.toBeNull();
  expect(
    contentBox!.y + contentBox!.height,
    `content overlaps sticky bar on ${context}`,
  ).toBeLessThanOrEqual(stickyBox!.y + OVERFLOW_TOLERANCE_PX);
}
