#!/usr/bin/env node

/**
 * Non-interactive bootstrap for e2e tests (optional).
 * Resets db.test.sqlite and runs db:init. `pnpm test:e2e` runs this automatically via global setup.
 *
 * Usage:
 *   pnpm test:e2e-bootstrap
 *   pnpm test:e2e   # builds, starts server, runs tests, stops server
 */

import { bootstrapTestDatabase } from '../tests/e2e/bootstrap-test-db.ts';
import { getE2eConfig } from '../tests/e2e/e2e-env.ts';

function main(): void {
  const config = getE2eConfig();
  bootstrapTestDatabase();

  process.env.E2E_PORT = String(config.E2E_PORT);
  process.env.SITE_URL = config.baseUrl;

  console.log('E2E bootstrap done.');
  console.log('Run the full suite (recommended): pnpm test:e2e');
  console.log('Optional manual server for debugging:');
  console.log(
    `  DATABASE_URL=./db.test.sqlite NODE_ENV=test SITE_URL=${config.baseUrl} pnpm dev --port ${config.E2E_PORT}`,
  );
}

main();
