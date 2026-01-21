import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getE2eConfig } from './e2e-env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

/**
 * Prepare a clean db.test.sqlite and initialize schema from scratch.
 * Ensures E2E env is valid via {@link getE2eConfig}.
 */
export function bootstrapTestDatabase(): void {
  getE2eConfig();

  process.env.DATABASE_URL = './db.test.sqlite';
  process.env.NODE_ENV = 'test';

  const testDbPath = join(projectRoot, 'db.test.sqlite');
  if (existsSync(testDbPath)) {
    rmSync(testDbPath);
  }

  execSync('pnpm db:init', {
    stdio: 'inherit',
    cwd: projectRoot,
    env: { ...process.env },
  });
}
