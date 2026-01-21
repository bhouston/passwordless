import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createRootRouteWithContext, HeadContent, Scripts } from '@tanstack/react-router';
import { GoogleAnalytics } from 'tanstack-router-ga4';
import { useEffect } from 'react';
import { Header } from '@/components/layout/Header';
import { SiteFooter } from '@/components/layout/SiteFooter';
import { Toaster } from '@/components/ui/sonner';
import type { RouterContext } from '@/lib/sessionTypes';
import { getSessionUserOptional } from '@/server/user';
import appCss from '../styles.css?url';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      refetchOnWindowFocus: false,
    },
  },
});

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const { sessionUser, hasPasskey } = await getSessionUserOptional();
    return { sessionUser, hasPasskey };
  },
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Passwordless user accounts demo',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  shellComponent: RootDocument,
});

function HydrationMarker() {
  useEffect(() => {
    document.body.dataset.hydrated = 'true';
  }, []);

  return null;
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <html lang="en">
        <head>
          <HeadContent />
        </head>
        <body
          className="flex min-h-dvh flex-col"
          data-hydrated="false"
          data-node-env={process.env.E2E_WEBAUTHN_HOOKS === '1' ? 'test' : (process.env.NODE_ENV ?? 'development')}
        >
          <GoogleAnalytics measurementId="G-N6EJ5EVDJL" />
          <HydrationMarker />
          <Header />
          <main className="flex min-h-0 w-full flex-1 flex-col">{children}</main>
          <SiteFooter />
          <Toaster />
          <Scripts />
        </body>
      </html>
    </QueryClientProvider>
  );
}
