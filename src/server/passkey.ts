import {
  type GenerateAuthenticationOptionsOpts,
  type GenerateRegistrationOptionsOpts,
  generateAuthenticationOptions as swaGenerateAuthenticationOptions,
  generateRegistrationOptions as swaGenerateRegistrationOptions,
  verifyAuthenticationResponse as swaVerifyAuthenticationResponse,
  verifyRegistrationResponse as swaVerifyRegistrationResponse,
  type VerifyAuthenticationResponseOpts,
  type VerifyRegistrationResponseOpts,
} from '@simplewebauthn/server';
import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { and, eq } from 'drizzle-orm';
import { UAParser } from 'ua-parser-js';
import { z } from 'zod';
import { db } from '@/db';
import { passkeys, users } from '@/db/schema';
import { setSessionUserId } from './appSession';
import { getEnvConfig } from './env';
import {
  PASSKEY_CHALLENGE_TOKEN_EXPIRATION,
  passkeyChallengeSignSchema,
  passkeyChallengeVerifiedPayloadSchema,
  passkeyDiscoverySignSchema,
  passkeyDiscoveryVerifiedPayloadSchema,
  signHs256Jwt,
  verifyHs256Jwt,
} from './jwt';
import { requireUser } from './middleware';

/**
 * Convert userId to base64url encoded Uint8Array for WebAuthn userID
 */
function userIdToUint8Array(userId: number): Uint8Array<ArrayBuffer> {
  const userIdStr = userId.toString();
  const encoder = new TextEncoder();
  return new Uint8Array(encoder.encode(userIdStr));
}

type AllowCredential = NonNullable<GenerateAuthenticationOptionsOpts['allowCredentials']>[number];

function parseStoredTransports(transports: string | null): AllowCredential['transports'] {
  if (!transports) {
    return undefined;
  }

  try {
    return JSON.parse(transports) as AllowCredential['transports'];
  } catch {
    return undefined;
  }
}

function buildPasskeyNameFromRequest(): string | null {
  const request = getRequest();
  const userAgent = request.headers.get('user-agent') || '';
  const parsedUserAgent = new UAParser(userAgent).getResult();

  if (!parsedUserAgent.browser.name) {
    return null;
  }

  return `${parsedUserAgent.browser.name}${parsedUserAgent.os.name ? ` on ${parsedUserAgent.os.name}` : ''}`;
}

const generateRegistrationOptionsSchema = z.object({
  userId: z.number().int().positive(),
  userName: z.string().min(1),
  userDisplayName: z.string().min(1),
});

/**
 * Server function to generate registration options for passkey registration
 * Uses requireUser middleware to ensure authentication
 */
export const generateRegistrationOptions = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator(generateRegistrationOptionsSchema)
  .handler(async ({ data, context }) => {
    const user = context.user;
    if (user.id !== data.userId) {
      throw new Error('Not authorized');
    }

    const env = getEnvConfig();
    const opts: GenerateRegistrationOptionsOpts = {
      rpName: env.RP_NAME,
      rpID: env.RP_ID,
      userID: userIdToUint8Array(data.userId),
      userName: data.userName,
      userDisplayName: data.userDisplayName,
      timeout: 60000, // 60 seconds
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'required',
        authenticatorAttachment: undefined,
      },
    };

    const options = await swaGenerateRegistrationOptions(opts);

    // Create JWT token with challenge and user identity
    const token = await signHs256Jwt(
      { challenge: options.challenge, userId: data.userId, email: user.email },
      passkeyChallengeSignSchema,
      PASSKEY_CHALLENGE_TOKEN_EXPIRATION,
    );

    return {
      options,
      token,
    };
  });

const verifyRegistrationResponseSchema = z.object({
  response: z.unknown(),
  userId: z.number().int().positive(),
  token: z.string().min(1),
});

/**
 * Server function to verify registration response and store passkey
 * Uses requireUser middleware to ensure authentication
 */
export const verifyRegistrationResponse = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator(verifyRegistrationResponseSchema)
  .handler(async ({ data, context }) => {
    const user = context.user;
    if (user.id !== data.userId) {
      throw new Error('Not authorized');
    }

    // Verify token and extract challenge
    const tokenPayload = await verifyHs256Jwt(data.token, passkeyChallengeVerifiedPayloadSchema);
    const expectedChallenge = tokenPayload.challenge;

    if (tokenPayload.userId !== data.userId) {
      throw new Error('Token user ID does not match');
    }

    const env = getEnvConfig();
    const opts: VerifyRegistrationResponseOpts = {
      response: data.response as any,
      expectedChallenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      requireUserVerification: true,
    };

    const verification = await swaVerifyRegistrationResponse(opts);

    if (!verification.verified || !verification.registrationInfo) {
      throw new Error('Registration verification failed');
    }

    const registrationInfo = verification.registrationInfo;
    const { credential } = registrationInfo;
    const counter = credential.counter ?? 0;
    const transports = credential.transports;
    const authenticatorType = registrationInfo.credentialDeviceType === 'singleDevice' ? 'platform' : 'cross-platform';
    const name = buildPasskeyNameFromRequest();

    const existingCredential = await db
      .select({
        id: passkeys.id,
      })
      .from(passkeys)
      .where(eq(passkeys.credentialId, credential.id))
      .limit(1);

    if (existingCredential.length > 0) {
      throw new Error('This passkey is already registered.');
    }

    const publicKeyBase64 = Buffer.from(credential.publicKey).toString('base64url');

    await db.insert(passkeys).values({
      userId: data.userId,
      credentialId: credential.id,
      publicKey: publicKeyBase64,
      counter,
      authenticatorType,
      name,
      transports: transports ? JSON.stringify(transports) : null,
    });
  });

/**
 * Server function to initiate passkey discovery (no email/userId required)
 * Uses WebAuthn discovery flow where user selects their passkey
 */
export const initiatePasskeyDiscovery = createServerFn({
  method: 'POST',
}).handler(async () => {
  const env = getEnvConfig();
  const opts: GenerateAuthenticationOptionsOpts = {
    rpID: env.RP_ID,
    timeout: 60000, // 60 seconds
    // No allowCredentials array = discovery mode
    userVerification: 'required',
  };

  const options = await swaGenerateAuthenticationOptions(opts);

  // Create discovery token (challenge only, no userId)
  const token = await signHs256Jwt(
    { challenge: options.challenge },
    passkeyDiscoverySignSchema,
    PASSKEY_CHALLENGE_TOKEN_EXPIRATION,
  );

  return {
    options,
    token,
  };
});

const initiatePasskeyAuthForEmailSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

/**
 * Account-first passkey login: look up the user's credential by email, then return
 * authentication options scoped to that passkey (allowCredentials).
 */
export const initiatePasskeyAuthenticationForEmail = createServerFn({
  method: 'POST',
})
  .inputValidator(initiatePasskeyAuthForEmailSchema)
  .handler(async ({ data }) => {
    const email = data.email.trim();

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

    if (!user) {
      throw new Error('This email is not registered. Please sign up to create an account.');
    }

    const passkeyRows = await db.select().from(passkeys).where(eq(passkeys.userId, user.id));

    if (passkeyRows.length === 0) {
      throw new Error(
        'This account does not have a passkey yet. Login with an email code and add a passkey in settings.',
      );
    }

    const env = getEnvConfig();

    const opts: GenerateAuthenticationOptionsOpts = {
      rpID: env.RP_ID,
      timeout: 60000,
      allowCredentials: passkeyRows.map((passkey) => ({
        id: passkey.credentialId,
        transports: parseStoredTransports(passkey.transports),
      })),
      userVerification: 'required',
    };

    const options = await swaGenerateAuthenticationOptions(opts);
    const token = await signHs256Jwt(
      { challenge: options.challenge, userId: user.id, email: user.email },
      passkeyChallengeSignSchema,
      PASSKEY_CHALLENGE_TOKEN_EXPIRATION,
    );

    return {
      options,
      token,
    };
  });

const verifyAuthenticationResponseSchema = z.object({
  response: z.unknown(),
  token: z.string().min(1),
});

/**
 * Server function to verify authentication response and update counter
 * Also sets authentication cookie on success
 * Supports both discovery mode (no userId in token) and regular mode (userId in token)
 */
export const verifyAuthenticationResponse = createServerFn({ method: 'POST' })
  .inputValidator(verifyAuthenticationResponseSchema)
  .handler(async ({ data }) => {
    let isDiscovery = false;
    let expectedChallenge: string;
    let userId: number | undefined;

    try {
      const discoveryPayload = await verifyHs256Jwt(data.token, passkeyDiscoveryVerifiedPayloadSchema);
      isDiscovery = true;
      expectedChallenge = discoveryPayload.challenge;
    } catch {
      const tokenPayload = await verifyHs256Jwt(data.token, passkeyChallengeVerifiedPayloadSchema);
      expectedChallenge = tokenPayload.challenge;
      userId = tokenPayload.userId;
    }

    const response = data.response as { id?: string };
    const credentialId = response.id;
    if (!credentialId) {
      throw new Error('Credential ID missing from passkey response');
    }

    let passkey: typeof passkeys.$inferSelect;
    if (isDiscovery) {
      const passkeysFound = await db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId)).limit(1);

      const foundPasskey = passkeysFound[0];
      if (!foundPasskey) {
        throw new Error('Passkey not found');
      }

      passkey = foundPasskey;
      userId = passkey.userId;
    } else {
      if (!userId) {
        throw new Error('Invalid token');
      }

      const matchedPasskeys = await db.select().from(passkeys).where(eq(passkeys.credentialId, credentialId)).limit(1);

      const userPk = matchedPasskeys[0];
      if (!userPk) {
        throw new Error('Passkey not found');
      }

      if (userPk.userId !== userId) {
        throw new Error('This passkey does not match that account');
      }

      passkey = userPk;
    }

    const publicKeyBuffer = Buffer.from(passkey.publicKey, 'base64url');
    const publicKey = new Uint8Array(publicKeyBuffer.buffer, publicKeyBuffer.byteOffset, publicKeyBuffer.byteLength);

    const env = getEnvConfig();
    const opts: VerifyAuthenticationResponseOpts = {
      response: data.response as any,
      expectedChallenge,
      expectedOrigin: env.ORIGIN,
      expectedRPID: env.RP_ID,
      credential: {
        id: passkey.credentialId,
        publicKey,
        counter: passkey.counter,
      },
      requireUserVerification: true,
    };

    const verification = await swaVerifyAuthenticationResponse(opts);

    if (!verification.verified) {
      throw new Error('Authentication verification failed');
    }

    if (verification.authenticationInfo) {
      const newCounter = verification.authenticationInfo.newCounter;
      await db
        .update(passkeys)
        .set({
          counter: newCounter,
          lastUsedAt: new Date(),
        })
        .where(eq(passkeys.id, passkey.id));
    }

    if (!userId) {
      throw new Error('User ID not found');
    }

    await setSessionUserId(userId);
  });

const deletePasskeySchema = z.object({
  userId: z.number().int().positive(),
  passkeyId: z.number().int().positive(),
});

/**
 * Server function to delete passkey for a user
 * Uses requireUser middleware to ensure authentication
 */
export const deletePasskey = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator(deletePasskeySchema)
  .handler(async ({ data, context }) => {
    const user = context.user;
    if (user.id !== data.userId) {
      throw new Error('Not authorized');
    }

    await db.delete(passkeys).where(and(eq(passkeys.userId, data.userId), eq(passkeys.id, data.passkeyId)));
  });
