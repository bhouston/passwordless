import { createMiddleware } from '@tanstack/react-start';
import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { users } from '@/db/schema';
import { getSessionUserId } from './appSession';

/**
 * Authentication middleware that ensures a user is logged in
 * Reads the app session, loads the user from the database,
 * and attaches the user object to context for use in server functions
 */
export const requireUser = createMiddleware({ type: 'function' }).server(async ({ next }) => {
  const userId = await getSessionUserId();
  if (userId === undefined) {
    throw new Error('Not authenticated');
  }

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    throw new Error('User not found');
  }

  // Attach user to context for use in server functions
  return next({
    context: {
      user,
    },
  });
});
