import { createRouter } from '@tanstack/react-router';

// Import the generated route tree
import type { RouterContext } from '@/lib/sessionTypes';
import { routeTree } from './routeTree.gen';

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {
      sessionUser: null,
    } satisfies RouterContext,

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
