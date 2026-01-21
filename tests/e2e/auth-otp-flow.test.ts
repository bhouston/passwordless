import { describe, test } from 'vitest';

import { loginViaEmailCode, logout, signUpViaOtp } from './helpers/auth';
import { getE2eBrowser } from './playwright-shared';

describe('Auth OTP flow (signup, logout, login via SSE)', () => {
  test('signup -> logout -> login via email code using SSE OTP', async () => {
    const browser = await getE2eBrowser();
    const page = await browser.newPage();
    try {
      const testEmail = `e2e-${Date.now()}@example.com`;
      const testName = 'E2E User';

      await signUpViaOtp(page, { email: testEmail, name: testName });
      await logout(page);
      await loginViaEmailCode(page, { email: testEmail });
    } finally {
      await page.close();
    }
  }, 60_000);
});
