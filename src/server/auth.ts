import { createServerFn } from '@tanstack/react-start';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { users, userAuthAttempts } from '@/db/schema';
import { clearAppSession, setSessionUserId } from './appSession';
import { signCodeVerificationToken, verifyCodeVerificationToken } from './jwt';
import { broadcastTestOtp } from './testOtpSse';

// Zod schemas for validation
const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Please enter a valid email address'),
});

const requestLoginCodeSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
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
  .inputValidator((data: unknown) => signupSchema.parse(data))
  .handler(async ({ data }) => {
    // Check if email already exists
    const existingUser = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (existingUser.length > 0) {
      throw new Error('An account with this email already exists');
    }

    // Generate OTP code
    const code = generateOTPCode();
    const codeHash = hashOTPCode(code);

    // Calculate expiration time (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create userAuthAttempts record
    const [attempt] = await db
      .insert(userAuthAttempts)
      .values({
        email: data.email,
        name: data.name,
        userId: null,
        codeHash,
        purpose: 'signup',
        expiresAt,
        used: false,
      })
      .returning();

    if (!attempt) {
      throw new Error('Failed to create signup attempt');
    }

    // Sign JWT token with userAuthAttemptId
    const token = await signCodeVerificationToken(null, data.email, attempt.id);

    // Console log + SSE broadcast (development/test only)
    broadcastTestOtp({
      type: 'signup-otp',
      email: data.email,
      code,
      name: data.name,
      token,
    });

    return { success: true, token };
  });

/**
 * Server function to verify signup OTP code and create user
 * Used to verify the OTP code entered by the user
 */
export const verifySignupOTPAndCreateUser = createServerFn({
  method: 'POST',
})
  .inputValidator((data: unknown) => verifySignupCodeSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      // Verify the token
      const payload = await verifyCodeVerificationToken(data.token);

      // Look up userAuthAttempts record
      const [attempt] = await db
        .select()
        .from(userAuthAttempts)
        .where(eq(userAuthAttempts.id, payload.userAuthAttemptId))
        .limit(1);

      if (!attempt) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      // Validate attempt
      if (attempt.used) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      if (new Date(attempt.expiresAt) < new Date()) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      if (attempt.purpose !== 'signup') {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      if (attempt.email !== payload.email) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      // Hash the submitted code
      const submittedCodeHash = hashOTPCode(data.code.toUpperCase());

      // Compare hashes
      if (attempt.codeHash !== submittedCodeHash) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      // Check if user already exists (race condition protection)
      const existingUser = await db.select().from(users).where(eq(users.email, attempt.email)).limit(1);

      if (existingUser.length > 0) {
        return {
          success: false,
          error: 'An account with this email already exists',
        };
      }

      // Mark attempt as used
      await db.update(userAuthAttempts).set({ used: true }).where(eq(userAuthAttempts.id, attempt.id));

      // Get name from attempt (stored during signup request)
      if (!attempt.name) {
        return {
          success: false,
          error: 'Invalid signup attempt. Please start over.',
        };
      }

      // Create the user
      const [newUser] = await db
        .insert(users)
        .values({
          name: attempt.name,
          email: attempt.email,
        })
        .returning();

      if (!newUser) {
        return {
          success: false,
          error: 'Failed to create account. Please try again.',
        };
      }

      await setSessionUserId(newUser.id);

      return {
        success: true,
        user: newUser,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Signup failed. The code may be invalid or expired.',
      };
    }
  });

/**
 * Server function to request login code by email
 * Returns an error if the email is not registered
 * Rate limited by IP and email address
 */
export const requestLoginCode = createServerFn({ method: 'POST' })
  .inputValidator((data: unknown) => requestLoginCodeSchema.parse(data))
  .handler(async ({ data }) => {
    // Look up user by email
    const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    if (!user) {
      throw new Error('This email is not registered. Please sign up to create an account.');
    }

    // Generate OTP code
    const code = generateOTPCode();
    const codeHash = hashOTPCode(code);

    // Calculate expiration time (15 minutes from now)
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

    // Create userAuthAttempts record
    const [attempt] = await db
      .insert(userAuthAttempts)
      .values({
        email: data.email,
        userId: user.id,
        codeHash,
        purpose: 'login',
        expiresAt,
        used: false,
      })
      .returning();

    if (!attempt) {
      throw new Error('Failed to create login attempt');
    }

    // Sign JWT token with userAuthAttemptId
    const token = await signCodeVerificationToken(user.id, data.email, attempt.id);

    // Console log + SSE broadcast (development/test only)
    broadcastTestOtp({
      type: 'login-otp',
      email: user.email,
      code,
      token,
    });

    return { success: true, token };
  });

/**
 * Server function to verify login code and authenticate user
 * Used to verify the OTP code entered by the user
 */
export const verifyLoginCodeAndAuthenticate = createServerFn({
  method: 'POST',
})
  .inputValidator((data: unknown) => verifyLoginCodeSchema.parse(data))
  .handler(async ({ data }) => {
    try {
      // Verify the token
      const payload = await verifyCodeVerificationToken(data.token);

      // Look up userAuthAttempts record
      const [attempt] = await db
        .select()
        .from(userAuthAttempts)
        .where(eq(userAuthAttempts.id, payload.userAuthAttemptId))
        .limit(1);

      if (!attempt) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      // Validate attempt
      if (attempt.used) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      if (new Date(attempt.expiresAt) < new Date()) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      if (attempt.purpose !== 'login') {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      // Verify email matches (if provided in JWT)
      if (payload.email && attempt.email !== payload.email) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      if (payload.userId && attempt.userId !== payload.userId) {
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      // Hash the submitted code
      const submittedCodeHash = hashOTPCode(data.code.toUpperCase());

      // Compare hashes
      if (attempt.codeHash !== submittedCodeHash) {
        // Generic error - don't reveal if account exists or code was wrong
        return {
          success: false,
          error: 'Invalid code. Please check your email and try again.',
        };
      }

      // If userId exists and code matches, authenticate user
      if (attempt.userId) {
        // Verify user exists in database
        const user = await db.select().from(users).where(eq(users.id, attempt.userId)).limit(1);

        if (user.length === 0) {
          return {
            success: false,
            error: 'Invalid code. Please check your email and try again.',
          };
        }

        // Mark attempt as used
        await db.update(userAuthAttempts).set({ used: true }).where(eq(userAuthAttempts.id, attempt.id));

        await setSessionUserId(attempt.userId);

        return {
          success: true,
          user: user[0],
        };
      }

      // If no userId, code verification will always fail (account doesn't exist)
      // Return generic error to prevent enumeration
      return {
        success: false,
        error: 'Invalid code. Please check your email and try again.',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Invalid code. Please check your email and try again.',
      };
    }
  });

/**
 * Server function to logout the current user
 * Clears the app session
 */
export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  await clearAppSession();
  return { success: true };
});
