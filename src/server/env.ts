import { z } from 'zod';

/**
 * Environment configuration schema
 * All fields are required with no defaults - application will fail fast if missing
 */
const envConfigSchema = z.object({
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  SITE_URL: z.string().url('SITE_URL must be a valid URL'),
  SITE_NAME: z.string().min(1, 'SITE_NAME is required'),
  RP_ID: z.string().min(1, 'RP_ID must not be empty').optional(),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NODE_ENV: z.enum(['development', 'production', 'test']).optional(),
});

type EnvConfig = Omit<z.infer<typeof envConfigSchema>, 'RP_ID' | 'SITE_URL'> & {
  SITE_URL: string;
  RP_ID: string;
  BASE_URL: string; // Alias for SITE_URL (backward compatibility)
  ORIGIN: string; // Alias for SITE_URL (backward compatibility)
  RP_NAME: string; // Alias for SITE_NAME (backward compatibility)
};

let envConfig: EnvConfig | null = null;

/**
 * Get validated environment configuration
 * Parses and validates process.env on first call, caches result
 * Throws error if any required environment variable is missing or invalid
 */
export function getEnvConfig(): EnvConfig {
  if (!envConfig) {
    const parsed = envConfigSchema.parse(process.env);
    const siteUrl = new URL(parsed.SITE_URL);
    const configuredRpId = parsed.RP_ID?.trim();

    // Normalize SITE_URL to its origin so WebAuthn checks don't depend on
    // whether the env var included a trailing slash.
    const origin = siteUrl.origin;

    // Derive RP_ID from SITE_URL when not explicitly overridden.
    const rpId = configuredRpId || siteUrl.hostname;

    // Create config with aliases for backward compatibility
    envConfig = {
      ...parsed,
      SITE_URL: origin,
      RP_ID: rpId,
      BASE_URL: origin,
      ORIGIN: origin,
      RP_NAME: parsed.SITE_NAME,
    };
  }
  return envConfig;
}
