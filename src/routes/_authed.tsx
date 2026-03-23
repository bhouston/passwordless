import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/_authed')({
  beforeLoad: ({ context }) => {
    if (!context.sessionUser) {
      throw redirect({
        to: '/login',
      });
    }
    return {
      sessionUser: context.sessionUser,
    };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  return <Outlet />;
}
