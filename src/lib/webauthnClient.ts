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
    throw error;
  }

  return startRegistration(...args);
}

export async function startPasskeyAuthentication(...args: Parameters<typeof startAuthentication>) {
  const error = consumeTestError('nextAuthenticationError');
  if (error) {
    throw error;
  }

  return startAuthentication(...args);
}
