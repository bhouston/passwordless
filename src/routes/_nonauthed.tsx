import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_nonauthed')({
  beforeLoad: ({ context, location }) => {
    if (context.sessionUser) {
      const redirectTo = `${location.pathname}${location.search}`;
      throw redirect({
        to: '/logout',
        search: { redirectTo },
      });
    }
  },
  component: NonAuthedLayout,
});

function NonAuthedLayout() {
  return <Outlet />;
}
