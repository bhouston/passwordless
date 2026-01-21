/**
 * Session user shape exposed to the client (no secrets).
 */
export type SessionUser = {
  id: number;
  name: string;
  email: string;
};

/**
 * Root route context: optional session from auth cookie (TanStack Start pattern).
 */
export type RouterContext = {
  sessionUser: SessionUser | null;
  hasPasskey: boolean;
};
