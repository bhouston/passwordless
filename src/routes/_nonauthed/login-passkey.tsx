import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useEffect, useRef, useState } from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { useToastMutation } from '@/hooks/useToastMutation';
import { isWebAuthnSupported, startPasskeyAuthentication } from '@/lib/webauthnClient';
import { initiatePasskeyDiscovery, verifyAuthenticationResponse } from '@/server/passkey';

export const Route = createFileRoute('/_nonauthed/login-passkey')({
  component: LoginPasskeyPage,
});

function LoginPasskeyPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const generateAuthOptions = useServerFn(initiatePasskeyDiscovery);
  const verifyAuthResponseFn = useServerFn(verifyAuthenticationResponse);
  const [formError, setFormError] = useState<string>();
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
      await navigate({ to: '/user-settings', reloadDocument: true });
    },
    setFormError,
  });

  // Automatically trigger passkey login on mount (unsupported browsers use the render branch below)
  useEffect(() => {
    if (hasAttemptedRef.current || !isWebAuthnSupported()) return;
    hasAttemptedRef.current = true;
    void passkeyLoginMutation.mutateAsync();
  }, [passkeyLoginMutation]);

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
              <Link to="/login">Back to Login</Link>
            </Button>
          </div>
        </div>
      </AuthLayout>
    );
  }

  // Show error state
  if (formError) {
    return (
      <AuthLayout title="Passkey Login Failed">
        <div className="space-y-4">
          <p className="text-center text-muted-foreground">{formError}</p>
          <div className="flex flex-col gap-2">
            <Button asChild={true} className="w-full" variant="outline">
              <Link to="/login">Back to Login</Link>
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
