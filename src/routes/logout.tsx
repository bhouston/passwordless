import { createFileRoute, redirect, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect } from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useToastMutation } from '@/hooks/useToastMutation';
import { logout } from '@/server/auth';
import { getUserWithPasskey } from '@/server/user';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/logout')({
  beforeLoad: async ({ location }) => {
    try {
      await getUserWithPasskey({});
    } catch {
      const redirectTo = `${location.pathname}${location.search}`;
      throw redirect({
        to: '/login',
        search: { redirectTo },
      });
    }
  },
  component: LogoutPage,
});

function LogoutPage() {
  const router = useRouter();
  const logoutFn = useServerFn(logout);

  const logoutMutation = useToastMutation({
    action: 'Logout',
    mutationFn: () => logoutFn({}),
    onSuccess: () => router.navigate({ to: '/login' }),
  });

  useEffect(() => {
    if (logoutMutation.isPending) {
      return;
    }
    logoutMutation.mutate();
  }, [logoutMutation]);

  return (
    <AuthLayout title={logoutMutation.isPending ? 'Logging out...' : 'Logging out...'}>
      <div className={cn(logoutMutation.isPending ? 'hidden' : 'space-y-4')}>
        <p className="text-center text-muted-foreground">Please wait while we clear your session...</p>
      </div>
    </AuthLayout>
  );
}
