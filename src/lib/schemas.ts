import { z } from 'zod';

/** Search params for `/logout` when redirecting after sign-out (e.g. from `_nonauthed` guard). */
export const redirectToSchema = z.object({
  redirectTo: z.string().optional().default('/'),
});
