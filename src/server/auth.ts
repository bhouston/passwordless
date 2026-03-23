import { createServerFn } from '@tanstack/react-start';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users } from '@/db/schema';
import { clearAppSession, setSessionUserId } from './appSession';
import {
  CODE_VERIFICATION_TOKEN_EXPIRATION,
  codeVerificationSignInputSchema,
  codeVerificationVerifiedPayloadSchema,
  signHs256Jwt,
  verifyHs256Jwt,
} from './jwt';
import { broadcastTestOtp } from './testOtp';

// Zod schemas for validation
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.email('Please enter a valid email address'),
});

const requestLoginCodeSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

const verifyLoginCodeSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  code: z
    .string()
    .length(8, 'Code must be 8 characters')
    .regex(/^[A-Z0-9]{8}$/, 'Code must be alphanumeric (A-Z, 0-9)'),
});

const verifySignupCodeSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  code: z
    .string()
    .length(8, 'Code must be 8 characters')
    .regex(/^[A-Z0-9]{8}$/, 'Code must be alphanumeric (A-Z, 0-9)'),
});

/**
 * Generate an 8-character alphanumeric OTP code (A-Z, 0-9)
 * @returns 8-character alphanumeric code as string
 */
function generateOTPCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Hash an OTP code using SHA-256
 * @param code - OTP code to hash
 * @returns Hashed code as hex string
 */
function hashOTPCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase()).digest('hex');
}

/**
 * Server function to request signup OTP code
 * Checks if email already exists and generates OTP code
 * Rate limited by IP and email address
 */
export const requestSignupOTP = createServerFn({ method: 'POST' })
  .inputValidator(signupSchema)
  .handler(async ({ data }) => {
    // Check if email already exists
    const existingUser = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (existingUser.length > 0) {
      throw new Error('An account with this email already exists');
    }

    // Generate OTP code
    const code = generateOTPCode();
    const otpHash = hashOTPCode(code);

    const token = await signHs256Jwt(
      {
        purpose: 'signup',
        email: data.email,
        name: data.name,
        otpHash,
      },
      codeVerificationSignInputSchema,
      CODE_VERIFICATION_TOKEN_EXPIRATION,
    );

    // Console log + SSE broadcast (development/test only)
    broadcastTestOtp({
      type: 'signup-otp',
      email: data.email,
      code,
      name: data.name,
      token,
    });

    return { token };
  });

/**
 * Server function to verify signup OTP code and create user
 * Used to verify the OTP code entered by the user
 */
export const verifySignupOTPAndCreateUser = createServerFn({
  method: 'POST',
})
  .inputValidator(verifySignupCodeSchema)
  .handler(async ({ data }) => {
    const payload = await verifyHs256Jwt(data.token, codeVerificationVerifiedPayloadSchema);

    if (payload.purpose !== 'signup') {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    const submittedOtpHash = hashOTPCode(data.code.toUpperCase());
    if (payload.otpHash !== submittedOtpHash) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    const existingUser = await db.select().from(users).where(eq(users.email, payload.email)).limit(1);

    if (existingUser.length > 0) {
      throw new Error('An account with this email already exists');
    }

    const [newUser] = await db
      .insert(users)
      .values({
        name: payload.name,
        email: payload.email,
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create account. Please try again.');
    }

    await setSessionUserId(newUser.id);

    return { user: newUser };
  });

/**
 * Server function to request login code by email
 * Returns an error if the email is not registered
 * Rate limited by IP and email address
 */
export const requestLoginCode = createServerFn({ method: 'POST' })
  .inputValidator(requestLoginCodeSchema)
  .handler(async ({ data }) => {
    // Look up user by email
    const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (!user) {
      throw new Error('This email is not registered. Please sign up to create an account.');
    }

    const code = generateOTPCode();
    const otpHash = hashOTPCode(code);

    const token = await signHs256Jwt(
      {
        purpose: 'login',
        userId: user.id,
        email: data.email,
        otpHash,
      },
      codeVerificationSignInputSchema,
      CODE_VERIFICATION_TOKEN_EXPIRATION,
    );

    // Console log + SSE broadcast (development/test only)
    broadcastTestOtp({
      type: 'login-otp',
      email: user.email,
      code,
      token,
    });

    return { token };
  });

/**
 * Server function to verify login code and authenticate user
 * Used to verify the OTP code entered by the user
 */
export const verifyLoginCodeAndAuthenticate = createServerFn({
  method: 'POST',
})
  .inputValidator(verifyLoginCodeSchema)
  .handler(async ({ data }) => {
    const payload = await verifyHs256Jwt(data.token, codeVerificationVerifiedPayloadSchema);

    if (payload.purpose !== 'login') {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    const submittedOtpHash = hashOTPCode(data.code.toUpperCase());
    if (payload.otpHash !== submittedOtpHash) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);

    if (!dbUser || dbUser.email !== payload.email) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    await setSessionUserId(payload.userId);

    return { user: dbUser };
  });

/**
 * Server function to logout the current user
 * Clears the app session
 */
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await clearAppSession();
});
