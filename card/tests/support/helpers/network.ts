import type { Page } from '@playwright/test';

export async function failOnConsoleError(page: Page) {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`console.error: ${msg.text()}`);
  });
  return () => {
    if (errors.length) throw new Error(`Console/page errors:\n${errors.join('\n')}`);
  };
}

export async function waitForSocketConnected(page: Page, timeoutMs = 10_000) {
  await page.waitForFunction(
    () => {
      const w = window as unknown as { __socketConnected?: boolean };
      return w.__socketConnected === true;
    },
    { timeout: timeoutMs }
  );
}
