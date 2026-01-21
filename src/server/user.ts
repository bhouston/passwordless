import { createServerFn } from '@tanstack/react-start';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { passkeys, users } from '@/db/schema';
import type { SessionUser } from '@/lib/sessionTypes';
import { getSessionUserId } from './appSession';
import { requireUser } from './middleware';

const updateUserNameSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

const getUserByIdSchema = z.object({
  userId: z.number().int().positive(),
});

const getUserByEmailSchema = z.object({
  email: z.string().email(),
});

/**
 * Server function to get user by ID
 */
export const getUserById = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => getUserByIdSchema.parse(data))
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.id, data.userId)).limit(1);

    return user || null;
  });

/**
 * Server function to get user by email
 */
export const getUserByEmail = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => getUserByEmailSchema.parse(data))
  .handler(async ({ data }) => {
    const [user] = await db.select().from(users).where(eq(users.email, data.email)).limit(1);

    return user || null;
  });

/**
 * Server function to update user name
 * Uses requireUser middleware to ensure authentication
 */
export const updateUserName = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator((data: unknown) => updateUserNameSchema.parse(data))
  .handler(async ({ data, context }) => {
    const user = context.user;

    const [updatedUser] = await db.update(users).set({ name: data.name }).where(eq(users.id, user.id)).returning();

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return {
      success: true,
      user: updatedUser,
    };
  });

/**
 * Optional session: reads auth cookie and returns user + passkey flag, or null when unauthenticated.
 * Used by root beforeLoad (TanStack Start pattern); does not throw.
 */
export const getSessionUserOptional = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{
    sessionUser: SessionUser | null;
    hasPasskey: boolean;
  }> => {
    const userId = await getSessionUserId();
    if (userId === undefined) {
      return { sessionUser: null, hasPasskey: false };
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return { sessionUser: null, hasPasskey: false };
    }

    const userPasskey = await db.select().from(passkeys).where(eq(passkeys.userId, user.id)).limit(1);

    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return {
      sessionUser,
      hasPasskey: userPasskey.length > 0,
    };
  },
);

/**
 * Server function to get user with passkey status
 * Uses requireUser middleware to ensure authentication
 * Note: This function doesn't require input data as it uses middleware to get the user
 */
export const getUserWithPasskey = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .handler(async ({ context }) => {
    const user = context.user;

    // Check if user has a passkey
    const userPasskey = await db.select().from(passkeys).where(eq(passkeys.userId, user.id)).limit(1);

    return {
      user,
      hasPasskey: userPasskey.length > 0,
    };
  });

const userHasPasskeySchema = z.object({
  userId: z.number().int().positive(),
});

/**
 * Server function to check if user has a passkey by user ID
 */
export const userHasPasskey = createServerFn({ method: 'GET' })
  .inputValidator((data: unknown) => userHasPasskeySchema.parse(data))
  .handler(async ({ data }) => {
    const userPasskey = await db.select().from(passkeys).where(eq(passkeys.userId, data.userId)).limit(1);

    return userPasskey.length > 0;
  });

const getUserPasskeysSchema = z.object({
  userId: z.number().int().positive(),
});

export type UserPasskeyListItem = {
  id: number;
  authenticatorType: 'platform' | 'cross-platform';
  name: string | null;
  createdAt: string;
  lastUsedAt: string | null;
};

/**
 * Server function to get a user's passkeys for the settings page.
 * Uses requireUser middleware to ensure authentication.
 */
export const getUserPasskeys = createServerFn({ method: 'GET' })
  .middleware([requireUser])
  .inputValidator((data: unknown) => getUserPasskeysSchema.parse(data))
  .handler(async ({ data, context }): Promise<UserPasskeyListItem[]> => {
    const user = context.user;
    if (user.id !== data.userId) {
      throw new Error('Not authorized');
    }

    const userPasskeys = await db
      .select({
        id: passkeys.id,
        authenticatorType: passkeys.authenticatorType,
        name: passkeys.name,
        createdAt: passkeys.createdAt,
        lastUsedAt: passkeys.lastUsedAt,
      })
      .from(passkeys)
      .where(eq(passkeys.userId, data.userId))
      .orderBy(asc(passkeys.createdAt));

    return userPasskeys.map((passkey) => ({
      id: passkey.id,
      authenticatorType: passkey.authenticatorType,
      name: passkey.name,
      createdAt: passkey.createdAt.toISOString(),
      lastUsedAt: passkey.lastUsedAt ? passkey.lastUsedAt.toISOString() : null,
    }));
  });
