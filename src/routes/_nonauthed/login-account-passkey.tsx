import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, useNavigate, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { z } from 'zod';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToastMutation } from '@/hooks/useToastMutation';
import { isWebAuthnSupported, startPasskeyAuthentication } from '@/lib/webauthnClient';
import { initiatePasskeyAuthenticationForEmail, verifyAuthenticationResponse } from '@/server/passkey';

const accountPasskeyLoginSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

export const Route = createFileRoute('/_nonauthed/login-account-passkey')({
  component: LoginAccountPasskeyPage,
});

function LoginAccountPasskeyPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [formError, setFormError] = useState<string>();
  const initiateForEmailFn = useServerFn(initiatePasskeyAuthenticationForEmail);
  const verifyAuthResponseFn = useServerFn(verifyAuthenticationResponse);

  const loginMutation = useToastMutation({
    action: 'Passkey login (email first)',
    toastSuccess: false,
    toastError: false,
    mutationFn: async (variables: { email: string }) => {
      const start = await initiateForEmailFn({ data: variables });

      const authenticationResponse = await startPasskeyAuthentication(
        { optionsJSON: start.options },
        { flow: 'account' },
      );

      await verifyAuthResponseFn({
        data: {
          response: authenticationResponse,
          token: start.token,
        },
      });
    },
    onSuccess: async () => {
      await router.invalidate();
      await navigate({ to: '/user-settings', reloadDocument: true });
    },
    setFormError,
  });

  const form = useForm({
    defaultValues: {
      email: '',
    },
    validators: {
      onChange: accountPasskeyLoginSchema,
    },
    onSubmit: async ({ value }) => {
      if (!isWebAuthnSupported()) {
        setFormError('Passkeys are not supported in this browser. Try another login method.');
        return;
      }
      await loginMutation.mutateAsync(value);
    },
  });

  if (!isWebAuthnSupported()) {
    return (
      <AuthLayout title="Passkey Not Supported" subTitle="Account-first passkey login needs WebAuthn">
        <p className="mb-4 text-center text-muted-foreground">
          Use discoverable passkey login or login with an email code instead.
        </p>
        <Button asChild={true} className="w-full">
          <Link to="/login">Back to Login</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Login with passkey" subTitle="Enter your email, then authenticate with your passkey">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="email">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor={field.name}>Email</FieldLabel>
                <Input
                  id={field.name}
                  name={field.name}
                  type="email"
                  value={field.state.value}
                  onBlur={field.handleBlur}
                  onChange={(e) => field.handleChange(e.target.value)}
                  aria-invalid={field.state.meta.errors.length > 0}
                  placeholder="you@example.com"
                  autoComplete="username webauthn"
                />
                <FieldDescription>
                  We look up your account, then your browser will ask you to use one of the passkeys registered for this
                  email (account-first WebAuthn).
                </FieldDescription>
                {field.state.meta.errors.length > 0 && <FieldError>{field.state.meta.errors[0]?.message}</FieldError>}
              </Field>
            )}
          </form.Field>

          {formError && <FieldError>{formError}</FieldError>}

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Field>
                <Button
                  type="submit"
                  disabled={!canSubmit || isSubmitting || loginMutation.isPending}
                  className="w-full"
                >
                  {isSubmitting || loginMutation.isPending ? 'Waiting for passkey…' : 'Continue with passkey'}
                </Button>
              </Field>
            )}
          </form.Subscribe>

          <div className="text-center text-sm text-muted-foreground">
            <Link
              className="font-medium text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
              to="/login"
            >
              Back to Login
            </Link>
          </div>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
