export type WebAuthnAuthenticationFlow = 'discovery' | 'account';

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
