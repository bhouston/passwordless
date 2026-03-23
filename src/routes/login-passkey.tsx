import { createFileRoute, getRouteApi, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useRef, useState } from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { useToastMutation } from '@/hooks/useToastMutation';
import { redirectToSchema } from '@/lib/schemas';
import { isWebAuthnSupported, startPasskeyAuthentication } from '@/lib/webauthnClient';
import { initiatePasskeyDiscovery, verifyAuthenticationResponse } from '@/server/passkey';

const rootRouteApi = getRouteApi('__root__');

export const Route = createFileRoute('/login-passkey')({
  validateSearch: redirectToSchema,
  component: LoginPasskeyPage,
});

function LoginPasskeyPage() {
  const { redirectTo = '/' } = Route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const { sessionUser } = rootRouteApi.useRouteContext();
  const generateAuthOptions = useServerFn(initiatePasskeyDiscovery);
  const verifyAuthResponseFn = useServerFn(verifyAuthenticationResponse);
  const [error, setError] = useState<string>();
  const hasAttemptedRef = useRef(false);

  const passkeyLoginMutation = useToastMutation({
    action: 'Passkey Login',
    toastSuccess: false, // Don't show toast, we'll redirect immediately
    mutationFn: async () => {
      const result = await generateAuthOptions({});

      const authenticationResponse = await startPasskeyAuthentication(
        { optionsJSON: result.options },
        { flow: 'discovery' },
      );

      await verifyAuthResponseFn({
        data: {
          response: authenticationResponse,
          token: result.token,
        },
      });
    },
    onSuccess: async () => {
      await router.invalidate();
      await navigate({ to: redirectTo, reloadDocument: true });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : 'An error occurred during passkey authentication.');
    },
  });

  // Automatically trigger passkey login on mount
  useEffect(() => {
    // Prevent multiple attempts
    if (hasAttemptedRef.current) return;

    // If user is already logged in, redirect
    if (sessionUser) {
      void navigate({ to: redirectTo });
      return;
    }

    // Check WebAuthn support
    if (!isWebAuthnSupported()) {
      setError('Passkeys are not supported in this browser. Please use a modern browser.');
      hasAttemptedRef.current = true;
      return;
    }

    // Trigger passkey authentication
    hasAttemptedRef.current = true;
    void passkeyLoginMutation.mutateAsync();
  }, [sessionUser, redirectTo, navigate, passkeyLoginMutation]);

  // Redirect if already logged in
  if (sessionUser) {
    return null; // Will redirect in useEffect
  }

  // Show error if WebAuthn not supported
  if (!isWebAuthnSupported()) {
    return (
      <AuthLayout title="Passkey Not Supported">
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">
            Passkeys are not supported in this browser. Please use a modern browser or login with an email code.
          </p>
          <div className="flex flex-col gap-2">
            <Button asChild={true} className="w-full">
              <Link search={{ redirectTo }} to="/login">
                Back to Login
              </Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Show error state
  if (error) {
    return (
      <AuthLayout title="Passkey Login Failed">
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">{error}</p>
          <div className="flex flex-col gap-2">
            <Button asChild={true} className="w-full" variant="outline">
              <Link search={{ redirectTo }} to="/login">
                Back to Login
              </Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Show loading state
  return (
    <AuthLayout title="Completing login...">
      <div className="space-y-4">
        <p className="text-center text-muted-foreground">
          {passkeyLoginMutation.isPending
            ? 'Please use your passkey to complete login...'
            : 'Preparing passkey authentication...'}
        </p>
      </div>
    </AuthLayout>
  );
}
