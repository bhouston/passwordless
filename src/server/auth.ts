import { createServerFn } from '@tanstack/react-start';
import { createHash, randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { otpChallenges, users } from '@/db/schema';
import { clearAppSession, setSessionUserId } from './appSession';
import {
  codeVerificationSignInputSchema,
  codeVerificationVerifiedPayloadSchema,
  signHs256Jwt,
  verifyHs256Jwt,
} from './jwt';
import { getEnvConfig } from './env';
import { createExpiresAt } from './time';
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
  const maxByte = Math.floor(256 / chars.length) * chars.length;

  while (code.length < 8) {
    const bytes = randomBytes(8 - code.length);

    for (const byte of bytes) {
      if (byte >= maxByte) {
        continue;
      }

      code += chars.charAt(byte % chars.length);
      if (code.length === 8) {
        break;
      }
    }
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
    const env = getEnvConfig();

    // Check if email already exists
    const existingUser = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (existingUser.length > 0) {
      throw new Error('An account with this email already exists');
    }

    // Generate OTP code
    const code = generateOTPCode();
    const otpHash = hashOTPCode(code);
    const expiresAt = createExpiresAt(env.CODE_VERIFICATION_TOKEN_EXPIRATION);

    const [challenge] = await db
      .insert(otpChallenges)
      .values({
        operation: 'signup',
        email: data.email,
        name: data.name,
        codeHash: otpHash,
        expiresAt,
      })
      .returning({ id: otpChallenges.id });

    if (!challenge) {
      throw new Error('Failed to issue sign-up code. Please try again.');
    }

    const token = await signHs256Jwt(
      {
        purpose: 'signup',
        otpChallengeId: challenge.id,
      },
      codeVerificationSignInputSchema,
      expiresAt,
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

    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, payload.otpChallengeId))
      .limit(1);

    if (!challenge || challenge.operation !== 'signup' || challenge.usedAt) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new Error('This code has expired. Please request a new one.');
    }

    const submittedOtpHash = hashOTPCode(data.code.toUpperCase());
    if (challenge.codeHash !== submittedOtpHash) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    const existingUser = await db.select().from(users).where(eq(users.email, challenge.email)).limit(1);

    if (existingUser.length > 0) {
      throw new Error('An account with this email already exists');
    }

    if (!challenge.name) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    await db
      .update(otpChallenges)
      .set({
        usedAt: new Date(),
      })
      .where(eq(otpChallenges.id, challenge.id));

    const [newUser] = await db
      .insert(users)
      .values({
        name: challenge.name,
        email: challenge.email,
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
    const env = getEnvConfig();

    // Look up user by email
    const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (!user) {
      throw new Error('This email is not registered. Please sign up to create an account.');
    }

    const code = generateOTPCode();
    const otpHash = hashOTPCode(code);
    const expiresAt = createExpiresAt(env.CODE_VERIFICATION_TOKEN_EXPIRATION);

    const [challenge] = await db
      .insert(otpChallenges)
      .values({
        operation: 'login',
        userId: user.id,
        email: user.email,
        codeHash: otpHash,
        expiresAt,
      })
      .returning({ id: otpChallenges.id });

    if (!challenge) {
      throw new Error('Failed to issue login code. Please try again.');
    }

    const token = await signHs256Jwt(
      {
        purpose: 'login',
        otpChallengeId: challenge.id,
      },
      codeVerificationSignInputSchema,
      expiresAt,
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

    const [challenge] = await db
      .select()
      .from(otpChallenges)
      .where(eq(otpChallenges.id, payload.otpChallengeId))
      .limit(1);

    if (!challenge || challenge.operation !== 'login' || challenge.usedAt || !challenge.userId) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new Error('This code has expired. Please request a new one.');
    }

    const submittedOtpHash = hashOTPCode(data.code.toUpperCase());
    if (challenge.codeHash !== submittedOtpHash) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    const [dbUser] = await db.select().from(users).where(eq(users.id, challenge.userId)).limit(1);

    if (!dbUser || dbUser.email !== challenge.email) {
      throw new Error('Invalid code. Please check your email and try again.');
    }

    await db
      .update(otpChallenges)
      .set({
        usedAt: new Date(),
      })
      .where(eq(otpChallenges.id, challenge.id));

    await setSessionUserId(challenge.userId);

    return { user: dbUser };
  });

/**
 * Server function to logout the current user
 * Clears the app session
 */
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await clearAppSession();
});
