import type { Page } from 'playwright-chromium';
import { launchBrowser } from './capture-browser.ts';
import type { PngComparison } from './compare-png-2-png.ts';
import { comparePng2Png } from './compare-png-2-png.ts';
import { browser as viewport } from './constants.ts';

/** Capture a screenshot of an HTML file and compare it to an expected image. */
export async function compareHtml2Png(
  htmlPath: string,
  expectedImagePath: string
): Promise<PngComparison> {
  let page: Page | undefined;

  try {
    const browser = await launchBrowser();
    const context = await browser.newContext();
    page = await context.newPage();
    const { width, height } = viewport;
    const previewImagePath = `${htmlPath}.png`;

    await page.setViewportSize({ width, height });
    await page.goto(`file://${htmlPath}`);
    await page.screenshot({
      omitBackground: true,
      path: previewImagePath,
      type: 'png',
      clip: { x: 0, y: 0, width, height }
    });

    return comparePng2Png(previewImagePath, expectedImagePath);
  } finally {
    await page?.close();
  }
}
