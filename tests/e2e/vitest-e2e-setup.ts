import { afterAll } from 'vitest';

import { closeE2eBrowser } from './playwright-shared';

afterAll(async () => {
  await closeE2eBrowser();
});
