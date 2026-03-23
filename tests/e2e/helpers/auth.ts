import { expect, type Page } from '@playwright/test';

import { getE2eConfig } from '../e2e-env';

const { baseUrl } = getE2eConfig();

type OtpType = 'signup-otp' | 'login-otp';

async function waitForHydration(page: Page) {
  await page.waitForFunction(() => document.body.dataset.hydrated === 'true');
}

async function typeIntoField(page: Page, label: RegExp, value: string) {
  const input = page.getByLabel(label);
  await input.click();
  await input.clear();
  await page.keyboard.type(value);
}

async function getLatestOtpPayload(type: OtpType, email: string): Promise<{ code: string; token: string }> {
  const maxAttempts = 20;
  const url = `${baseUrl}/api/otp-latest?type=${type}&email=${encodeURIComponent(email)}`;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`api/otp-latest failed: ${res.status}`);
    }

    const data = (await res.json()) as { code?: string; token?: string };
    if (data.code && data.token) {
      return { code: data.code, token: data.token };
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`No ${type} payload received for ${email} within timeout`);
}

export async function getLastOtp(type: OtpType, email: string): Promise<{ code: string }> {
  const maxAttempts = 20;
  const url = `${baseUrl}/api/otp-latest?type=${type}&email=${encodeURIComponent(email)}`;

  for (let i = 0; i < maxAttempts; i++) {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`api/otp-latest failed: ${res.status}`);
    }

    const data = (await res.json()) as { code?: string };
    if (data.code) {
      return { code: data.code };
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(`No ${type} received for ${email} within timeout`);
}

export async function signUpViaOtp(
  page: Page,
  {
    email,
    name,
  }: {
    email: string;
    name: string;
  },
) {
  await page.goto(`${baseUrl}/signup`);
  await waitForHydration(page);
  await expect(page.getByLabel(/name/i)).toBeVisible();

  await typeIntoField(page, /name/i, name);
  await typeIntoField(page, /email/i, email);
  await page.getByRole('button', { name: 'Sign Up' }).click();

  const { code: signupCode, token } = await getLatestOtpPayload('signup-otp', email);

  if (!page.url().includes(`/signup-verify/${token}`)) {
    await page.goto(`${baseUrl}/signup-verify/${token}`);
  }

  await expect(page).toHaveURL((url) => url.pathname === `/signup-verify/${token}`, { timeout: 15000 });

  expect(signupCode).toHaveLength(8);

  await page.getByText(/Enter the 8-character/).waitFor({ state: 'visible', timeout: 10000 });
  await page.locator("[data-slot='input-otp']").click();
  await page.keyboard.type(signupCode);
  await page.getByRole('button', { name: /Verify Code/ }).click();

  await expect(page).toHaveURL(/\/user-settings/, { timeout: 15000 });
}

export async function logout(page: Page) {
  await page.goto(`${baseUrl}/logout`);
  await waitForHydration(page);
  await page.getByRole('button', { name: /^Log out$/i }).click();
  await expect(page).toHaveURL((url) => url.pathname === '/', { timeout: 15000 });
}

export async function loginViaEmailCode(
  page: Page,
  {
    email,
  }: {
    email: string;
  },
) {
  await page.goto(`${baseUrl}/login`);
  await waitForHydration(page);
  await expect(page.getByRole('button', { name: /login with passkey/i })).toBeVisible();
  await page.getByRole('button', { name: /login via email code/i }).click();
  await expect(page).toHaveURL(/\/login-request-code/);

  await waitForHydration(page);
  await typeIntoField(page, /email/i, email);
  await page.getByRole('button', { name: /Send Login Code/ }).click();

  const { code: loginCode, token } = await getLatestOtpPayload('login-otp', email);

  if (!page.url().includes(`/login-via-code/${token}`)) {
    await page.goto(`${baseUrl}/login-via-code/${token}`);
  }

  await expect(page).toHaveURL((url) => url.pathname === `/login-via-code/${token}`, {
    timeout: 15000,
  });

  expect(loginCode).toHaveLength(8);

  await page.getByText(/Enter the 8-character/).waitFor({ state: 'visible', timeout: 10000 });
  await page.locator("[data-slot='input-otp']").click();
  await page.keyboard.type(loginCode);
  await page.getByRole('button', { name: /Verify Code/ }).click();

  await expect(page).toHaveURL(/\/user-settings/, { timeout: 15000 });
}
