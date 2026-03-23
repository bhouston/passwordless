import { startAuthentication, startRegistration } from '@simplewebauthn/browser';

type WebAuthnTestError = {
  name: string;
  message?: string;
};

type WebAuthnTestState = {
  isSupported?: boolean;
  nextAuthenticationError?: WebAuthnTestError;
  nextRegistrationError?: WebAuthnTestError;
};

declare global {
  interface Window {
    __testWebAuthn?: WebAuthnTestState;
  }
}

export type WebAuthnAuthenticationFlow = 'discovery' | 'account';

function isNodeTestEnv() {
  return typeof document !== 'undefined' && document.body?.dataset.nodeEnv === 'test';
}

function consumeTestError(key: 'nextAuthenticationError' | 'nextRegistrationError') {
  if (!isNodeTestEnv()) {
    return null;
  }

  const testState = window.__testWebAuthn;
  const error = testState?.[key];
  if (!error) {
    return null;
  }

  delete testState[key];

  return new DOMException(error.message ?? error.name, error.name);
}

/**
 * Maps browser WebAuthn errors (DOMException / Error) to user-facing messages.
 * Server-side verification errors are unrelated; those come from server functions as thrown Error.
 */
export function toFriendlyWebAuthnError(err: unknown, kind: WebAuthnAuthenticationFlow | 'register'): Error {
  if (!(err instanceof Error)) {
    return new Error('Passkey request failed', { cause: err });
  }

  const { name, message } = err;

  if (name === 'NotAllowedError') {
    if (kind === 'register') {
      return new Error('Registration cancelled', { cause: err });
    }
    return new Error('Authentication was cancelled or not allowed by your device.', { cause: err });
  }

  if (name === 'InvalidStateError') {
    if (kind === 'discovery') {
      return new Error('No passkey found. Please login with an email code instead.', { cause: err });
    }
    if (kind === 'account') {
      return new Error('No matching passkey found for this account on this device.', { cause: err });
    }
    return new Error('Could not complete passkey registration on this device.', { cause: err });
  }

  if (name === 'NotSupportedError') {
    return new Error('Passkeys are not supported in this browser. Please use a modern browser.', { cause: err });
  }

  if (message.includes('cancelled') || message.includes('abort')) {
    return new Error(kind === 'register' ? 'Registration cancelled' : 'Authentication cancelled', { cause: err });
  }

  return err;
}

export function isWebAuthnSupported() {
  if (typeof window === 'undefined') {
    return false;
  }

  if (isNodeTestEnv()) {
    return window.__testWebAuthn?.isSupported ?? 'PublicKeyCredential' in window;
  }

  return 'PublicKeyCredential' in window;
}

export async function startPasskeyRegistration(...args: Parameters<typeof startRegistration>) {
  const error = consumeTestError('nextRegistrationError');
  if (error) {
    throw toFriendlyWebAuthnError(error, 'register');
  }

  try {
    return await startRegistration(...args);
  } catch (err) {
    throw toFriendlyWebAuthnError(err, 'register');
  }
}

export async function startPasskeyAuthentication(
  options: Parameters<typeof startAuthentication>[0],
  opts: { flow: WebAuthnAuthenticationFlow },
) {
  const error = consumeTestError('nextAuthenticationError');
  if (error) {
    throw toFriendlyWebAuthnError(error, opts.flow);
  }

  try {
    return await startAuthentication(options);
  } catch (err) {
    throw toFriendlyWebAuthnError(err, opts.flow);
  }
}
