import { createFileRoute, Link, redirect, useNavigate } from '@tanstack/react-router';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { redirectToSchema } from '@/lib/schemas';
import { getUserWithPasskey } from '@/server/user';

export const Route = createFileRoute('/login')({
  validateSearch: redirectToSchema,
  beforeLoad: async ({ search }) => {
    // Check if user is already logged in
    try {
      await getUserWithPasskey({});
      // User is logged in, redirect to user settings (or redirectTo if provided)
      throw redirect({
        to: search.redirectTo || '/user-settings',
      });
    } catch (error) {
      // If it's a redirect, re-throw it
      if (error && typeof error === 'object' && 'to' in error) {
        throw error;
      }
      // Otherwise, user is not logged in, continue to login page
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const { redirectTo = '/' } = Route.useSearch();

  return (
    <AuthLayout title="Login" subTitle="Choose your preferred login method">
      <div className="space-y-4">
        <div className="flex flex-col gap-3">
          <Field>
            <Button
              onClick={() => {
                void navigate({
                  to: '/login-passkey',
                  search: { redirectTo },
                });
              }}
              className="w-full"
            >
              Login with Passkey
            </Button>
          </Field>

          <Field>
            <Button
              onClick={() => {
                void navigate({
                  to: '/login-account-passkey',
                  search: { redirectTo },
                });
              }}
              className="w-full"
              variant="outline"
            >
              Login with Account + Passkey
            </Button>
          </Field>

          <div className="my-4 flex items-center gap-4">
            <div className="flex-1 border-t border-border" />
            <span className="text-sm text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <Field>
            <Button
              onClick={() => {
                void navigate({
                  to: '/login-request-code',
                  search: { redirectTo },
                });
              }}
              className="w-full"
              variant="outline"
            >
              Login via Email Code
            </Button>
          </Field>
        </div>

        <div className="text-center text-sm text-muted-foreground">
          Don&apos;t have an account?{' '}
          <Link
            className="font-medium text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
            search={{ redirectTo }}
            to="/signup"
          >
            Sign Up
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
