import { createServerFn } from '@tanstack/react-start';
import { asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '@/db';
import { passkeys, users } from '@/db/schema';
import type { SessionUser } from '@/lib/sessionTypes';
import { requireUser } from './middleware';
import { useAppSession } from './appSession';

const updateUserNameSchema = z.object({
  name: z.string().min(1, 'Name is required'),
});

/**
 * Server function to update user name
 * Uses requireUser middleware to ensure authentication
 */
export const updateUserName = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .inputValidator(updateUserNameSchema)
  .handler(async ({ data, context }) => {
    const user = context.user;

    const [updatedUser] = await db.update(users).set({ name: data.name }).where(eq(users.id, user.id)).returning();

    if (!updatedUser) {
      throw new Error('User not found');
    }

    return { user: updatedUser };
  });

/**
 * Optional session: reads auth cookie and returns user, or null when unauthenticated.
 * Used by root beforeLoad (TanStack Start pattern); does not throw.
 */
export const getSessionUserOptional = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{
    sessionUser: SessionUser | null;
  }> => {
    const userId = (await useAppSession()).data.userId;
    if (userId === undefined) {
      return { sessionUser: null };
    }

    const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

    if (!user) {
      return { sessionUser: null };
    }

    const sessionUser: SessionUser = {
      id: user.id,
      name: user.name,
      email: user.email,
    };

    return {
      sessionUser,
    };
  },
);

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
  .inputValidator(getUserPasskeysSchema)
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
