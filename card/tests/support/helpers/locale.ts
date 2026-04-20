import type { Page } from '@playwright/test';

export async function setLocale(page: Page, locale: 'en' | 'he') {
  await page.addInitScript((loc) => {
    try {
      window.localStorage.setItem('lang', loc);
    } catch {
      /* ignore */
    }
  }, locale);
}

export async function expectRtl(page: Page, isRtl: boolean) {
  const dir = await page.evaluate(() => document.documentElement.dir || document.body.dir);
  if (isRtl && dir !== 'rtl') throw new Error(`Expected RTL, got dir="${dir}"`);
  if (!isRtl && dir === 'rtl') throw new Error(`Expected LTR, got dir="${dir}"`);
}
