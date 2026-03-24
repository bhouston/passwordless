export type TestOtpEventType = 'signup-otp' | 'login-otp';

export interface BroadcastTestOtpPayload {
  type: TestOtpEventType;
  email: string;
  code: string;
  name?: string;
  token?: string;
}

export interface LastTestOtpPayload {
  email: string;
  code: string;
  issuedAt: string;
  name?: string;
  token?: string;
}

/** Last emitted payloads per (type, email) so e2e and demo toast can fetch OTP by email. */
const lastPayloads = new Map<string, LastTestOtpPayload>();

function storageKey(type: TestOtpEventType, email: string): string {
  return `${type}:${email.toLowerCase()}`;
}

/**
 * Log OTP to console and store per (type, email).
 * Runs in all environments so demo toast works in production.
 * Use for signup and login code issuance in auth.ts.
 */
export function broadcastTestOtp(payload: BroadcastTestOtpPayload): void {
  const { type, email, code, name, token } = payload;
  const issuedAt = new Date().toISOString();

  // Centralized console logging
  if (type === 'signup-otp') {
    console.log('\n=== Signup One-Time Passcode ===');
    if (name) console.log(`Name: ${name}`);
    console.log(`Email: ${email}`);
    console.log(`Code: ${code}`);
    console.log('=======================\n');
  } else {
    console.log('\n=== Login One-Time Passcode ===');
    console.log(`Email: ${email}`);
    console.log(`Code: ${code}`);
    console.log('==================\n');
  }

  // Store for retrieval by (type, email)
  lastPayloads.set(storageKey(type, email), {
    email,
    code,
    issuedAt,
    ...(name && { name }),
    ...(token && { token }),
  });
}

/**
 * Get the last emitted OTP for a (type, email). Used by e2e and demo toast.
 */
export function getLastTestOtp(type: TestOtpEventType, email: string): LastTestOtpPayload | null {
  return lastPayloads.get(storageKey(type, email)) ?? null;
}
