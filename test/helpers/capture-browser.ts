import type { Browser } from 'playwright-chromium';
import { chromium } from 'playwright-chromium';

let browser: Browser | undefined;

export async function launchBrowser(): Promise<Browser> {
  browser ??= await chromium.launch();
  return browser;
}

export async function closeBrowser(): Promise<void> {
  await browser?.close();
  browser = undefined;
}
