#!/usr/bin/env node

import { execSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

function getProjectRoot(): string {
  const scriptDir = dirname(fileURLToPath(import.meta.url));
  return resolve(scriptDir, '..');
}

function resolveDatabasePaths(projectRoot: string, databaseUrl: string): string[] {
  if (databaseUrl === ':memory:') {
    return [];
  }

  const databasePath = isAbsolute(databaseUrl) ? databaseUrl : join(projectRoot, databaseUrl);

  return [databasePath, `${databasePath}-journal`, `${databasePath}-shm`, `${databasePath}-wal`];
}

function removeExistingDatabaseFiles(databasePaths: string[]) {
  for (const databasePath of databasePaths) {
    if (!existsSync(databasePath)) {
      continue;
    }

    rmSync(databasePath, { force: true });
    console.log(`✓ Removed ${databasePath}`);
  }
}

function main(): void {
  const projectRoot = getProjectRoot();
  const databaseUrl = process.env.DATABASE_URL ?? './db.sqlite';

  removeExistingDatabaseFiles(resolveDatabasePaths(projectRoot, databaseUrl));

  execSync('pnpm exec drizzle-kit push', {
    stdio: 'inherit',
    cwd: projectRoot,
    env: process.env,
  });
}

main();
