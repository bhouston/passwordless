import '@dotenvx/dotenvx/config';

import { z } from 'zod';

const e2eEnvSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SITE_NAME: z.string().min(1, 'SITE_NAME is required'),
  E2E_PORT: z.coerce.number().int('E2E_PORT must be an integer').min(1).max(65535).default(3001),
});

type E2eEnvParsed = z.infer<typeof e2eEnvSchema>;

export type E2eConfig = E2eEnvParsed & {
  /** Always `http://localhost:<E2E_PORT>`. */
  baseUrl: string;
};

let cache: E2eConfig | null = null;

/**
 * Loads `.env` via dotenvx (side effect on first import of this module), then reads and validates
 * `process.env` with Zod. Result is cached for the lifetime of the process.
 */
export function getE2eConfig(): E2eConfig {
  if (cache) {
    return cache;
  }

  const parsed = e2eEnvSchema.parse({
    JWT_SECRET: process.env.JWT_SECRET,
    SITE_NAME: process.env.SITE_NAME,
    E2E_PORT: process.env.E2E_PORT,
  });

  cache = {
    ...parsed,
    baseUrl: `http://localhost:${parsed.E2E_PORT}`,
  };
  return cache;
}
