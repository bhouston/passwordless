import type { CDPSession, Page } from '@playwright/test';

type CredentialSummary = {
  credentialId: string;
  isResidentCredential: boolean;
  signCount: number;
};

type TestWebAuthnError = {
  name: string;
  message?: string;
};

type TestWebAuthnState = {
  isSupported?: boolean;
  nextAuthenticationError?: TestWebAuthnError;
  nextRegistrationError?: TestWebAuthnError;
};

async function mergeTestState(page: Page, state: TestWebAuthnState) {
  await page.addInitScript((value) => {
    const testWindow = window as Window & {
      __testWebAuthn?: TestWebAuthnState;
    };

    testWindow.__testWebAuthn = {
      ...testWindow.__testWebAuthn,
      ...value,
    };
  }, state);

  await page.evaluate((value) => {
    const testWindow = window as Window & {
      __testWebAuthn?: TestWebAuthnState;
    };

    testWindow.__testWebAuthn = {
      ...testWindow.__testWebAuthn,
      ...value,
    };
  }, state);
}

export class WebAuthnHarness {
  private constructor(
    private readonly session: CDPSession,
    private readonly authenticatorId: string,
  ) {}

  static async installVirtualAuthenticator(page: Page) {
    const session = await page.context().newCDPSession(page);

    await session.send('WebAuthn.enable');

    const { authenticatorId } = await session.send('WebAuthn.addVirtualAuthenticator', {
      options: {
        protocol: 'ctap2',
        ctap2Version: 'ctap2_1',
        transport: 'internal',
        hasResidentKey: true,
        hasUserVerification: true,
        automaticPresenceSimulation: true,
        isUserVerified: true,
      },
    });

    return new WebAuthnHarness(session, authenticatorId);
  }

  async listCredentials(): Promise<CredentialSummary[]> {
    const { credentials } = await this.session.send('WebAuthn.getCredentials', {
      authenticatorId: this.authenticatorId,
    });

    return credentials as CredentialSummary[];
  }

  async resetCredentials() {
    await this.session.send('WebAuthn.clearCredentials', {
      authenticatorId: this.authenticatorId,
    });
  }

  async removeVirtualAuthenticator() {
    await this.session.send('WebAuthn.removeVirtualAuthenticator', {
      authenticatorId: this.authenticatorId,
    });
    await this.session.detach();
  }
}

export async function installVirtualAuthenticator(page: Page) {
  return WebAuthnHarness.installVirtualAuthenticator(page);
}

export async function setWebAuthnSupport(page: Page, isSupported: boolean) {
  await mergeTestState(page, { isSupported });
}

export async function setNextRegistrationError(page: Page, error: TestWebAuthnError) {
  await mergeTestState(page, { nextRegistrationError: error });
}

export async function setNextAuthenticationError(page: Page, error: TestWebAuthnError) {
  await mergeTestState(page, { nextAuthenticationError: error });
}
