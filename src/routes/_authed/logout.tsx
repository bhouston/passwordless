import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { useToastMutation } from '@/hooks/useToastMutation';
import { redirectToSchema } from '@/lib/schemas';
import { logout } from '@/server/auth';

export const Route = createFileRoute('/_authed/logout')({
  validateSearch: redirectToSchema,
  component: LogoutPage,
});

function LogoutPage() {
  const router = useRouter();
  const navigate = useNavigate();
  const { redirectTo = '/' } = Route.useSearch();
  const logoutFn = useServerFn(logout);

  const logoutMutation = useToastMutation({
    action: 'Logout',
    mutationFn: () => logoutFn({}),
    onSuccess: () => {
      void router.invalidate();
      void navigate({ to: redirectTo });
    },
  });

  return (
    <AuthLayout
      title="Log out"
      subTitle="You need to end your session to use this page with a different account, or to reach a guest-only page."
    >
      <div className="space-y-4">
        <Button
          type="button"
          className="w-full"
          disabled={logoutMutation.isPending}
          onClick={() => logoutMutation.mutate()}
        >
          {logoutMutation.isPending ? 'Logging out…' : 'Log out'}
        </Button>
      </div>
    </AuthLayout>
  );
}
