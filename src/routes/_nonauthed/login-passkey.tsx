import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { startAuthentication } from '@simplewebauthn/browser';
import { useState } from 'react';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup } from '@/components/ui/field';
import { useToastMutation } from '@/hooks/useToastMutation';
import { toFriendlyWebAuthnError } from '@/lib/webauthnErrors';
import { isWebAuthnSupported } from '@/lib/webauthnIsSupported';
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

  const passkeyLoginMutation = useToastMutation({
    action: 'Passkey Login',
    toastSuccess: false, // Don't show toast, we'll redirect immediately
    toastError: false,
    mutationFn: async () => {
      const result = await generateAuthOptions({});

      const authenticationResponse = await startAuthentication({
        optionsJSON: result.options,
      }).catch((err) => {
        throw toFriendlyWebAuthnError(err, 'discovery');
      });

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
    onMutate: () => {
      setFormError(undefined);
    },
    setFormError,
  });

  if (!isWebAuthnSupported()) {
    return (
      <AuthLayout title="Passkey Not Supported" subTitle="Discoverable passkey login needs WebAuthn">
        <p className="mb-4 text-center text-muted-foreground">
          Passkeys are not supported in this browser. Please use a modern browser or login with an email code.
        </p>
        <Button asChild={true} className="w-full">
          <Link to="/login">Back to Login</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Login with passkey" subTitle="Use a passkey saved to this device — no email required">
      <FieldGroup>
        <p className="text-center text-muted-foreground">
          When you continue, your browser will ask you to sign in with a passkey (discoverable / conditional WebAuthn).
        </p>

        {formError && <FieldError>{formError}</FieldError>}

        <Field>
          <Button
            type="button"
            className="w-full"
            disabled={passkeyLoginMutation.isPending}
            onClick={() => {
              void passkeyLoginMutation.mutateAsync();
            }}
          >
            {passkeyLoginMutation.isPending ? 'Waiting for passkey…' : 'Login with Passkey'}
          </Button>
        </Field>

        <div className="text-center text-sm text-muted-foreground">
          <Link
            className="font-medium text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
            to="/login"
          >
            Back to Login
          </Link>
        </div>
      </FieldGroup>
    </AuthLayout>
  );
}
