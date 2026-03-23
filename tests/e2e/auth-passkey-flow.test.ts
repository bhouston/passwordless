import { expect } from '@playwright/test';
import { describe, test } from 'vitest';

import { getE2eConfig } from './e2e-env';
import { logout, signUpViaOtp } from './helpers/auth';
import {
  type WebAuthnHarness,
  installVirtualAuthenticator,
  setNextAuthenticationError,
  setNextRegistrationError,
  setWebAuthnSupport,
} from './helpers/webauthn';
import { getE2eBrowser } from './playwright-shared';

const { baseUrl } = getE2eConfig();

async function disposeWebAuthn(harness: WebAuthnHarness | undefined) {
  if (!harness) {
    return;
  }
  await harness.resetCredentials();
  await harness.removeVirtualAuthenticator();
}

describe('Auth passkey flow', () => {
  test('signup -> register multiple passkeys -> logout -> login with email-first passkey flow', async () => {
    const browser = await getE2eBrowser();
    const page = await browser.newPage();
    let webauthn: WebAuthnHarness | undefined;
    try {
      const testEmail = `passkey-${Date.now()}@example.com`;
      const testName = 'Passkey E2E User';

      webauthn = await installVirtualAuthenticator(page);

      await signUpViaOtp(page, { email: testEmail, name: testName });
      await expect(page.getByText(/No passkeys registered yet\./i)).toBeVisible();

      await page.getByRole('button', { name: /Add Your First Passkey/i }).click();

      await expect(page.getByText(/Passkey registration succeeded!/i)).toBeVisible();
      await expect(page.getByRole('heading', { name: /Registered passkeys/i })).toBeVisible();
      await expect(page.getByText(/Created:/i)).toHaveCount(1);
      await expect(page.getByRole('button', { name: /^Delete$/i })).toHaveCount(1);

      await page.getByRole('button', { name: /^Add Passkey$/i }).click();

      await expect(page.getByRole('heading', { name: /Registered passkeys/i })).toBeVisible();
      await expect(page.getByText(/Created:/i)).toHaveCount(2);
      await expect(page.getByRole('button', { name: /^Delete$/i })).toHaveCount(2);

      const credentials = await webauthn.listCredentials();
      expect(credentials.length).toBeGreaterThanOrEqual(1);

      await logout(page);

      await page.goto(`${baseUrl}/login-account-passkey`);
      await page.getByLabel(/email/i).fill(testEmail);
      await page.getByRole('button', { name: /Continue with passkey/i }).click();

      await expect(page).toHaveURL(/\/user-settings/, { timeout: 15000 });
      await expect(page.getByText(/Created:/i)).toHaveCount(2);
    } finally {
      await disposeWebAuthn(webauthn);
      await page.close();
    }
  }, 60_000);

  test('deleting one passkey keeps the others listed', async () => {
    const browser = await getE2eBrowser();
    const page = await browser.newPage();
    let webauthn: WebAuthnHarness | undefined;
    try {
      const testEmail = `passkey-delete-${Date.now()}@example.com`;

      webauthn = await installVirtualAuthenticator(page);

      await signUpViaOtp(page, { email: testEmail, name: 'Delete Passkey User' });
      await page.getByRole('button', { name: /Add Your First Passkey/i }).click();
      await expect(page.getByText(/Created:/i)).toHaveCount(1);

      await page.getByRole('button', { name: /^Add Passkey$/i }).click();
      await expect(page.getByText(/Created:/i)).toHaveCount(2);

      await page
        .getByRole('button', { name: /^Delete$/i })
        .first()
        .click();

      await expect(page.getByText(/Passkey deletion succeeded!/i)).toBeVisible();
      await expect(page.getByText(/Created:/i)).toHaveCount(1);
      await expect(page.getByRole('button', { name: /^Delete$/i })).toHaveCount(1);
    } finally {
      await disposeWebAuthn(webauthn);
      await page.close();
    }
  });

  test('shows registration cancelled when passkey setup is cancelled', async () => {
    const browser = await getE2eBrowser();
    const page = await browser.newPage();
    try {
      const testEmail = `passkey-cancel-${Date.now()}@example.com`;

      await signUpViaOtp(page, { email: testEmail, name: 'Cancel Setup User' });
      await setNextRegistrationError(page, {
        name: 'NotAllowedError',
        message: 'The operation was cancelled.',
      });

      await page.getByRole('button', { name: /Add Your First Passkey/i }).click();

      await expect(page.getByText(/Registration cancelled/i)).toBeVisible();
      await expect(page.getByText(/No passkeys registered yet\./i)).toBeVisible();
    } finally {
      await page.close();
    }
  });

  test('shows an authentication cancelled error', async () => {
    const browser = await getE2eBrowser();
    const page = await browser.newPage();
    try {
      await setNextAuthenticationError(page, {
        name: 'NotAllowedError',
        message: 'The operation was cancelled.',
      });

      await page.goto(`${baseUrl}/login-passkey`);
      await page.getByRole('button', { name: /Login with Passkey/i }).click();

      await expect(
        page.getByRole('main').getByText(/Authentication was cancelled or not allowed by your device\./i),
      ).toBeVisible();
    } finally {
      await page.close();
    }
  });

  test('shows a missing passkey error when no credential is available', async () => {
    const browser = await getE2eBrowser();
    const page = await browser.newPage();
    try {
      await setNextAuthenticationError(page, {
        name: 'InvalidStateError',
        message: 'No passkey available',
      });

      await page.goto(`${baseUrl}/login-passkey`);
      await page.getByRole('button', { name: /Login with Passkey/i }).click();

      await expect(
        page.getByRole('main').getByText(/No passkey found\. Please login with an email code instead\./i),
      ).toBeVisible();
    } finally {
      await page.close();
    }
  });

  test('shows the unsupported browser message when WebAuthn is unavailable', async () => {
    const browser = await getE2eBrowser();
    const page = await browser.newPage();
    try {
      await setWebAuthnSupport(page, false);

      await page.goto(`${baseUrl}/login-passkey`);

      await expect(page.getByText(/Passkeys are not supported in this browser/i)).toBeVisible();
    } finally {
      await page.close();
    }
  });
});
