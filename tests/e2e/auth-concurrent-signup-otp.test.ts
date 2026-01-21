import { expect } from '@playwright/test';
import type { Page } from 'playwright';
import { describe, test } from 'vitest';

import { getE2eConfig } from './e2e-env';
import { getLastOtp } from './helpers/auth';
import { getE2eBrowser } from './playwright-shared';

const { baseUrl } = getE2eConfig();

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => document.body.dataset.hydrated === 'true');
}

async function startSignup(page: Page, { email, name }: { email: string; name: string }) {
  await page.goto(`${baseUrl}/signup`);
  await waitForHydration(page);

  await page.getByLabel(/name/i).fill(name);
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  await expect(page).toHaveURL(/\/signup\/[^/]+$/, { timeout: 15000 });
}

async function verifySignup(page: Page, code: string) {
  await page.getByText(/Enter the 8-character/).waitFor({ state: 'visible', timeout: 10000 });
  await page.locator("[data-slot='input-otp']").click();
  await page.keyboard.type(code);
  await page.getByRole('button', { name: /Verify Code/ }).click();
  await expect(page).toHaveURL(/\/user-settings/, { timeout: 15000 });
}

describe('Concurrent signup OTP flow', () => {
  test('two users can sign up in parallel with isolated OTP toasts', async () => {
    const browser = await getE2eBrowser();

    const userA = {
      email: `e2e-concurrent-a-${Date.now()}@example.com`,
      name: 'Concurrent User A',
    };
    const userB = {
      email: `e2e-concurrent-b-${Date.now()}@example.com`,
      name: 'Concurrent User B',
    };

    const contextA = await browser.newContext();
    const contextB = await browser.newContext();

    try {
      const pageA = await contextA.newPage();
      const pageB = await contextB.newPage();

      await Promise.all([startSignup(pageA, userA), startSignup(pageB, userB)]);

      const [{ code: codeA }, { code: codeB }] = await Promise.all([
        getLastOtp('signup-otp', userA.email),
        getLastOtp('signup-otp', userB.email),
      ]);

      expect(codeA).toHaveLength(8);
      expect(codeB).toHaveLength(8);
      expect(codeA).not.toBe(codeB);
      expect(pageA.url()).not.toBe(pageB.url());

      await expect(pageA.getByText(codeA, { exact: true })).toBeVisible();
      await expect(pageB.getByText(codeB, { exact: true })).toBeVisible();
      await expect(pageA.getByText(codeB, { exact: true })).toHaveCount(0);
      await expect(pageB.getByText(codeA, { exact: true })).toHaveCount(0);

      await Promise.all([verifySignup(pageA, codeA), verifySignup(pageB, codeB)]);
    } finally {
      await Promise.all([contextA.close(), contextB.close()]);
    }
  }, 90_000);
});
