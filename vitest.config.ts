import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    passWithNoTests: true,
    // E2E lives under tests/e2e — use `pnpm test:e2e` (vitest.e2e.config.ts + Playwright).
    exclude: ['**/node_modules/**', '**/dist/**', '**/.output/**', '**/tests/e2e/**'],
  },
});
