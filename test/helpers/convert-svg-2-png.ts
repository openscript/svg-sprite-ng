import type { Page } from 'playwright-chromium';
import { launchBrowser } from './capture-browser.ts';

export async function convertSvg2Png(svgPath: string, pngPath: string): Promise<void> {
  let page: Page | undefined;

  try {
    const browser = await launchBrowser();
    const context = await browser.newContext();
    page = await context.newPage();
    await page.goto(`file://${svgPath}`);

    await page.locator('svg').first().screenshot({
      omitBackground: true,
      path: pngPath,
      type: 'png'
    });
  } finally {
    await page?.close();
  }
}
