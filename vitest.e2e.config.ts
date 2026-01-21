import { defineConfig } from 'vitest/config';

/**
 * E2E: Node + Playwright against a real server.
 * globalSetup builds, starts `.output/server/index.mjs`, then tears it down.
 * (Vitest browser mode keeps tests in a harness iframe; loading the real app there would unload the runner.)
 */
export default defineConfig({
  test: {
    name: 'e2e',
    environment: 'node',
    include: ['tests/e2e/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/.output/**'],
    globalSetup: ['./tests/e2e/global-setup.ts'],
    setupFiles: ['./tests/e2e/vitest-e2e-setup.ts'],
    testTimeout: 120_000,
    hookTimeout: 120_000,
    maxWorkers: 1,
    fileParallelism: false,
  },
});
