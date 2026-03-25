import { createServerFn } from '@tanstack/react-start';
import { jwtVerify, SignJWT, type JWTPayload } from 'jose';
import { z } from 'zod';
import { getEnvConfig } from './env';

const jwtIssuedExpirySchema = z.object({
  iat: z.number(),
  exp: z.number(),
});

/** HS256 sign: validate claims with `signSchema`, then issue a JWT expiring at `expiresAt`. */
export async function signHs256Jwt<T extends JWTPayload>(
  claimsInput: unknown,
  signSchema: z.ZodType<T>,
  expiresAt: Date,
): Promise<string> {
  const validated = signSchema.parse(claimsInput);
  const env = getEnvConfig();
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const now = Math.floor(Date.now() / 1000);
  const expiresAtSeconds = Math.floor(expiresAt.getTime() / 1000);

  return await new SignJWT(validated)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(expiresAtSeconds)
    .sign(secret);
}

/** HS256 verify: check signature and expiry, then parse payload with `verifiedSchema`. */
export async function verifyHs256Jwt<T>(token: string, verifiedSchema: z.ZodType<T>): Promise<T> {
  const env = getEnvConfig();
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret, {
      algorithms: ['HS256'],
    });
    return verifiedSchema.parse(payload);
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

const codeVerificationSignupSignSchema = z.object({
  purpose: z.literal('signup'),
  otpChallengeId: z.number().int().positive(),
});

const codeVerificationLoginSignSchema = z.object({
  purpose: z.literal('login'),
  otpChallengeId: z.number().int().positive(),
});

/** Fields embedded in the JWT when issuing an OTP verification token (no iat/exp — jose adds those). */
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
export type OtpVerificationPayload = z.infer<typeof codeVerificationVerifiedPayloadSchema>;

export const passkeyChallengeSignSchema = z.object({
  challenge: z.string(),
  userId: z.number(),
  email: z.string(),
});

export const passkeyChallengeVerifiedPayloadSchema = passkeyChallengeSignSchema.merge(jwtIssuedExpirySchema);

export type PasskeyChallengeTokenPayload = z.infer<typeof passkeyChallengeVerifiedPayloadSchema>;

export const passkeyDiscoverySignSchema = z.object({
  challenge: z.string(),
});

export const passkeyDiscoveryVerifiedPayloadSchema = passkeyDiscoverySignSchema.merge(jwtIssuedExpirySchema);

export type PasskeyDiscoveryTokenPayload = z.infer<typeof passkeyDiscoveryVerifiedPayloadSchema>;

const validateCodeVerificationTokenInputSchema = z.object({
  token: z.string().min(1, 'Token is required'),
});

export const validateCodeVerificationToken = createServerFn({ method: 'GET' })
  .inputValidator(validateCodeVerificationTokenInputSchema)
  .handler(async ({ data }) => {
    await verifyHs256Jwt(data.token, codeVerificationVerifiedPayloadSchema);
  });
