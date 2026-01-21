import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context, location }) => {
    if (!context.sessionUser) {
      const redirectTo = `${location.pathname}${location.search}`;
      throw redirect({
        to: '/login',
        search: { redirectTo },
      });
    }
    return {
      sessionUser: context.sessionUser,
      hasPasskey: context.hasPasskey,
    };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return <Outlet />;
}
