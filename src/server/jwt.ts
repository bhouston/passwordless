import { createServerFn } from '@tanstack/react-start';
import { jwtVerify, SignJWT } from 'jose';
import { z } from 'zod';
import { getEnvConfig } from './env';

// Token expiration times (in seconds)
const CODE_VERIFICATION_TOKEN_EXPIRATION = 15 * 60; // 15 minutes
const PASSKEY_CHALLENGE_TOKEN_EXPIRATION = 10 * 60; // 10 minutes

const jwtIssuedExpirySchema = z.object({
  iat: z.number(),
  exp: z.number(),
});

const codeVerificationSignupSignSchema = z.object({
  purpose: z.literal('signup'),
  email: z.string(),
  name: z.string(),
  codeHash: z.string().min(1),
});

const codeVerificationLoginSignSchema = z.object({
  purpose: z.literal('login'),
  userId: z.number(),
  email: z.string(),
  codeHash: z.string().min(1),
});

/** Fields embedded in the JWT when issuing a code verification token (no iat/exp — jose adds those). */
export const codeVerificationSignInputSchema = z.discriminatedUnion('purpose', [
  codeVerificationSignupSignSchema,
  codeVerificationLoginSignSchema,
]);

/** Full payload after `jwtVerify` (includes standard time claims). */
export const codeVerificationVerifiedPayloadSchema = z.discriminatedUnion('purpose', [
  codeVerificationSignupSignSchema.merge(jwtIssuedExpirySchema),
  codeVerificationLoginSignSchema.merge(jwtIssuedExpirySchema),
]);

export type CodeVerificationSignInput = z.infer<typeof codeVerificationSignInputSchema>;
export type CodeVerificationTokenPayload = z.infer<typeof codeVerificationVerifiedPayloadSchema>;

/**
 * Passkey challenge token payload
 */
export interface PasskeyChallengeTokenPayload {
  challenge: string;
  userId: number;
  email: string;
  iat: number;
  exp: number;
}

/**
 * Passkey discovery token payload (for discovery flow without userId)
 */
export interface PasskeyDiscoveryTokenPayload {
  challenge: string;
  iat: number;
  exp: number;
}

/**
 * Creates a JWT for OTP verification (code hash and flow fields live in the token).
 */
export async function signCodeVerificationToken(input: CodeVerificationSignInput): Promise<string> {
  const validated = codeVerificationSignInputSchema.parse(input);
  const env = getEnvConfig();
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT(validated)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + CODE_VERIFICATION_TOKEN_EXPIRATION)
    .sign(secret);

  return token;
}

/**
 * Verifies and extracts payload from a code verification token
 * @param token - JWT token string
 * @returns Token payload if valid, throws error if invalid/expired
 */
export async function verifyCodeVerificationToken(token: string): Promise<CodeVerificationTokenPayload> {
  const env = getEnvConfig();
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return codeVerificationVerifiedPayloadSchema.parse(payload);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Token verification failed: invalid payload (${error.message})`, { cause: error });
    }
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`, { cause: error });
    }
    throw new Error('Token verification failed: Unknown error', { cause: error });
  }
}

const validateCodeVerificationTokenInputSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const validateCodeVerificationToken = createServerFn({ method: 'GET' })
  .inputValidator(validateCodeVerificationTokenInputSchema)
  .handler(async ({ data }) => {
    await verifyCodeVerificationToken(data.token);
    return { valid: true };
  });

/**
 * Creates a JWT token for passkey challenge verification
 * @param challenge - The WebAuthn challenge string
 * @param userId - User's ID
 * @param email - User's email
 * @returns Signed JWT token string
 */
export async function signPasskeyChallengeToken(challenge: string, userId: number, email: string): Promise<string> {
  const env = getEnvConfig();
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({ challenge, userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + PASSKEY_CHALLENGE_TOKEN_EXPIRATION)
    .sign(secret);

  return token;
}

/**
 * Verifies and extracts payload from a passkey challenge token
 * @param token - JWT token string
 * @returns Token payload if valid, throws error if invalid/expired
 */
export async function verifyPasskeyChallengeToken(token: string): Promise<PasskeyChallengeTokenPayload> {
  const env = getEnvConfig();
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    // Validate payload structure
    if (
      typeof payload.challenge !== 'string' ||
      typeof payload.userId !== 'number' ||
      typeof payload.email !== 'string'
    ) {
      throw new Error('Invalid token payload structure');
    }

    return {
      challenge: payload.challenge,
      userId: payload.userId,
      email: payload.email,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`, { cause: error });
    }
    throw new Error('Token verification failed: Unknown error', { cause: error });
  }
}

/**
 * Creates a JWT token for passkey discovery (challenge only, no userId)
 * @param challenge - The WebAuthn challenge string
 * @returns Signed JWT token string
 */
export async function signPasskeyDiscoveryToken(challenge: string): Promise<string> {
  const env = getEnvConfig();
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({ challenge })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + PASSKEY_CHALLENGE_TOKEN_EXPIRATION)
    .sign(secret);

  return token;
}

/**
 * Verifies and extracts payload from a passkey discovery token
 * @param token - JWT token string
 * @returns Token payload if valid, throws error if invalid/expired
 */
export async function verifyPasskeyDiscoveryToken(token: string): Promise<PasskeyDiscoveryTokenPayload> {
  const env = getEnvConfig();
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });

    // Validate payload structure (discovery token only has challenge)
    if (typeof payload.challenge !== 'string') {
      throw new Error('Invalid token payload structure');
    }

    return {
      challenge: payload.challenge,
      iat: payload.iat as number,
      exp: payload.exp as number,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Token verification failed: ${error.message}`, { cause: error });
    }
    throw new Error('Token verification failed: Unknown error', { cause: error });
  }
}
