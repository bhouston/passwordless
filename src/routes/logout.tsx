import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useRef, useState } from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { useToastMutation } from '@/hooks/useToastMutation';
import { logout } from '@/server/auth';
import { getUserWithPasskey } from '@/server/user';

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
  const queryClient = useQueryClient();
  const logoutFn = useServerFn(logout);
  const hasStartedRef = useRef(false);
  const [error, setError] = useState<string>();

  const logoutMutation = useToastMutation({
    action: 'Logout',
    toastSuccess: false, // Don't show toast, we'll redirect immediately
    mutationFn: async () => {
      await logoutFn({});
    },
    onSuccess: async () => {
      await queryClient.clear();
      await router.navigate({ to: '/login' });
    },
    onError: async (err) => {
      setError(err instanceof Error ? err.message : 'Failed to log out.');
    },
  });

  useEffect(() => {
    if (hasStartedRef.current) {
      return;
    }

    hasStartedRef.current = true;
    logoutMutation.mutate();
  }, [logoutMutation]);

  return (
    <AuthLayout title={error ? 'Logout Failed' : 'Logging out...'}>
      <div className="space-y-4">
        <p className="text-center text-muted-foreground">
          {error ? error : 'Please wait while we clear your session...'}
        </p>
        {error && (
          <div className="flex flex-col gap-2">
            <Button onClick={() => logoutMutation.mutate()} disabled={logoutMutation.isPending} className="w-full">
              Try again
            </Button>
            <Button asChild={true} className="w-full" variant="outline">
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>
        )}
      </div>
    </AuthLayout>
  );
}
