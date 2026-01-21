import { execSync, spawn, type ChildProcess } from 'node:child_process';
import { createConnection } from 'node:net';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { TestProject } from 'vitest/node';

import { bootstrapTestDatabase } from './bootstrap-test-db';
import { getE2eConfig } from './e2e-env';

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, '../..');

function assertPortFree(port: number, host = '127.0.0.1'): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const socket = createConnection({ port, host }, () => {
      socket.destroy();
      reject(
        new Error(`E2E port ${port} is already in use on ${host}. Free the port or set E2E_PORT to an available port.`),
      );
    });
    socket.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'ECONNREFUSED') {
        resolvePromise();
        return;
      }
      reject(err);
    });
  });
}

function assertPortAcceptsConnections(port: number, host = '127.0.0.1'): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const socket = createConnection({ port, host }, () => {
      socket.destroy();
      resolvePromise();
    });
    socket.on('error', (err: NodeJS.ErrnoException) => {
      reject(new Error(`E2E server is not accepting TCP connections on ${host}:${port}: ${err.message}`));
    });
  });
}

async function waitForHttpOk(
  url: string,
  { timeoutMs = 90_000, intervalMs = 250 }: { timeoutMs?: number; intervalMs?: number } = {},
): Promise<void> {
  const start = Date.now();
  let lastErr: unknown;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url, { redirect: 'manual' });
      if (res.ok || (res.status >= 300 && res.status < 400)) {
        return;
      }
      lastErr = new Error(`GET ${url} -> ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for E2E server at ${url}. Last error: ${String(lastErr)}`);
}

export default async function globalSetup(_project: TestProject): Promise<() => Promise<void>> {
  const config = getE2eConfig();
  const port = config.E2E_PORT;
  const baseUrl = config.baseUrl;

  process.env.E2E_PORT = String(port);
  process.env.E2E_BASE_URL = baseUrl;

  await assertPortFree(port);

  bootstrapTestDatabase();
  process.env.SITE_URL = baseUrl;
  process.env.PORT = String(port);

  execSync('pnpm vite build', {
    stdio: 'inherit',
    cwd: projectRoot,
    env: { ...process.env, NODE_ENV: 'production' },
  });

  const serverEntry = join(projectRoot, '.output/server/index.mjs');
  if (!existsSync(serverEntry)) {
    throw new Error(`Missing ${serverEntry} after build.`);
  }

  let child: ChildProcess | undefined = spawn(
    process.execPath,
    // TanStack Start / Nitro server bundle uses tsyringe decorators; needs reflect-metadata at runtime.
    ['--import', 'reflect-metadata', serverEntry],
    {
      cwd: projectRoot,
      env: {
        ...process.env,
        // Production build inlines NODE_ENV on the client; use E2E_WEBAUTHN_HOOKS so SSR exposes data-node-env="test"
        // for webauthnClient test hooks (see src/routes/__root.tsx).
        NODE_ENV: 'test',
        E2E_WEBAUTHN_HOOKS: '1',
        PORT: String(port),
        SITE_URL: baseUrl,
        DATABASE_URL: './db.test.sqlite',
      },
      stdio: 'inherit',
    },
  );

  child.on('error', (err) => {
    console.error('[e2e global-setup] server process error:', err);
  });

  const healthUrl = `${baseUrl}/`;
  await waitForHttpOk(healthUrl);
  await assertPortAcceptsConnections(port);

  console.log(`[e2e global-setup] Server listening at ${baseUrl}`);

  return async () => {
    if (child?.pid) {
      child.kill('SIGTERM');
      await new Promise<void>((resolvePromise) => {
        const t = setTimeout(() => {
          child?.kill('SIGKILL');
          resolvePromise();
        }, 10_000);
        child?.on('exit', () => {
          clearTimeout(t);
          resolvePromise();
        });
      });
    }
    child = undefined;
  };
}
