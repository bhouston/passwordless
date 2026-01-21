import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { createFileRoute, Link, redirect, useNavigate, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { z } from 'zod';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToastMutation } from '@/hooks/useToastMutation';
import { redirectToSchema } from '@/lib/schemas';
import { isWebAuthnSupported, startPasskeyAuthentication } from '@/lib/webauthnClient';
import { initiatePasskeyAuthenticationForEmail, verifyAuthenticationResponse } from '@/server/passkey';
import { getUserWithPasskey } from '@/server/user';

const accountPasskeyLoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

export const Route = createFileRoute('/login-account-passkey')({
  validateSearch: redirectToSchema,
  beforeLoad: async ({ search }) => {
    try {
      await getUserWithPasskey({});
      throw redirect({
        to: search.redirectTo || '/user-settings',
      });
    } catch (error) {
      if (error && typeof error === 'object' && 'to' in error) {
        throw error;
      }
    }
  },
  component: LoginAccountPasskeyPage,
});

function LoginAccountPasskeyPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { redirectTo = '/' } = Route.useSearch();
  const [formError, setFormError] = useState<string>();
  const initiateForEmailFn = useServerFn(initiatePasskeyAuthenticationForEmail);
  const verifyAuthResponseFn = useServerFn(verifyAuthenticationResponse);

  const loginMutation = useToastMutation({
    action: 'Passkey login (email first)',
    toastSuccess: false,
    toastError: false,
    mutationFn: async (variables: { email: string }) => {
      const start = await initiateForEmailFn({ data: variables });
      if (!start.success || !start.options || !start.token) {
        throw new Error(start.error || 'Could not start passkey login.');
      }

      let authenticationResponse: Awaited<ReturnType<typeof startPasskeyAuthentication>>;
      try {
        authenticationResponse = await startPasskeyAuthentication({
          optionsJSON: start.options,
        });
      } catch (err) {
        if (err instanceof Error) {
          if (err.name === 'NotAllowedError') {
            throw new Error('Authentication was cancelled or not allowed by your device.', { cause: err });
          }
          if (err.name === 'InvalidStateError') {
            throw new Error('No matching passkey found for this account on this device.', { cause: err });
          }
          if (err.name === 'NotSupportedError') {
            throw new Error('Passkeys are not supported in this browser. Please use a modern browser.', { cause: err });
          }
        }
        throw err;
      }

      const verification = await verifyAuthResponseFn({
        data: {
          response: authenticationResponse,
          token: start.token,
        },
      });

      if (!verification.success) {
        throw new Error(verification.error || 'Authentication failed');
      }

      return verification;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['SESSION'] });
      await router.invalidate();
      await navigate({ to: redirectTo, reloadDocument: true });
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
          <Link search={{ redirectTo }} to="/login">
            Back to Login
          </Link>
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

          <Field>
            <Button asChild={true} variant="outline" className="w-full">
              <Link search={{ redirectTo }} to="/login">
                Other login options
              </Link>
            </Button>
          </Field>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
