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
  originalPublicKeyCredential?: typeof PublicKeyCredential;
};

async function mergeTestState(page: Page, state: TestWebAuthnState) {
  const applyState = (value: TestWebAuthnState) => {
    const testWindow = window as Window & {
      __testWebAuthn?: TestWebAuthnState;
    };

    const existingState = testWindow.__testWebAuthn ?? {};
    const nextState = {
      ...existingState,
      ...value,
    };

    if (typeof value.isSupported === 'boolean') {
      if (!value.isSupported) {
        if (!existingState.originalPublicKeyCredential) {
          nextState.originalPublicKeyCredential = window.PublicKeyCredential;
        }
        Object.defineProperty(window, 'PublicKeyCredential', {
          configurable: true,
          value: undefined,
        });
      } else if (existingState.originalPublicKeyCredential) {
        Object.defineProperty(window, 'PublicKeyCredential', {
          configurable: true,
          value: existingState.originalPublicKeyCredential,
        });
      }
    }

    testWindow.__testWebAuthn = nextState;
  };

  await page.addInitScript(applyState, state);
  await page.evaluate(applyState, state);
}

async function installErrorInjectionHooks(page: Page) {
  const installHooks = () => {
    type CredentialsWithHooks = CredentialsContainer & {
      __testWrappedGet?: boolean;
      __testWrappedCreate?: boolean;
      __testOriginalGet?: CredentialsContainer['get'];
      __testOriginalCreate?: CredentialsContainer['create'];
    };

    const credentials = navigator.credentials as CredentialsWithHooks | undefined;
    if (!credentials) {
      return;
    }
    const testWindow = window as Window & {
      __testWebAuthn?: TestWebAuthnState;
    };

    if (!credentials.__testWrappedCreate && credentials.create) {
      credentials.__testOriginalCreate = credentials.create.bind(credentials);
      credentials.create = async (...args) => {
        const nextError = testWindow.__testWebAuthn?.nextRegistrationError;
        if (nextError) {
          testWindow.__testWebAuthn = {
            ...testWindow.__testWebAuthn,
            nextRegistrationError: undefined,
          };
          throw new DOMException(nextError.message ?? nextError.name, nextError.name);
        }
        return (await credentials.__testOriginalCreate?.(...args)) ?? null;
      };
      credentials.__testWrappedCreate = true;
    }

    if (!credentials.__testWrappedGet && credentials.get) {
      credentials.__testOriginalGet = credentials.get.bind(credentials);
      credentials.get = async (...args) => {
        const nextError = testWindow.__testWebAuthn?.nextAuthenticationError;
        if (nextError) {
          testWindow.__testWebAuthn = {
            ...testWindow.__testWebAuthn,
            nextAuthenticationError: undefined,
          };
          throw new DOMException(nextError.message ?? nextError.name, nextError.name);
        }
        return (await credentials.__testOriginalGet?.(...args)) ?? null;
      };
      credentials.__testWrappedGet = true;
    }
  };

  await page.addInitScript(installHooks);
  await page.evaluate(installHooks);
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
  await installErrorInjectionHooks(page);
  await mergeTestState(page, { nextRegistrationError: error });
}

export async function setNextAuthenticationError(page: Page, error: TestWebAuthnError) {
  await installErrorInjectionHooks(page);
  await mergeTestState(page, { nextAuthenticationError: error });
}
