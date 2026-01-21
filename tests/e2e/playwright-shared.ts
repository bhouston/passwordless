import { chromium, type Browser } from 'playwright';

let browser: Browser | undefined;

export async function getE2eBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: process.env.CI === 'true' || process.env.HEADLESS !== 'false',
    });
  }
  return browser;
}

export async function closeE2eBrowser(): Promise<void> {
  await browser?.close();
  browser = undefined;
}
