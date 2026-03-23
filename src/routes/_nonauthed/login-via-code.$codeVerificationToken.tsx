import { useForm } from '@tanstack/react-form';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { useToastMutation } from '@/hooks/useToastMutation';
import { verifyLoginCodeAndAuthenticate } from '@/server/auth';
import { validateCodeVerificationToken } from '@/server/jwt';

export const Route = createFileRoute('/_nonauthed/login-via-code/$codeVerificationToken')({
  beforeLoad: async ({ params }) => {
    // Verify token exists and is valid (don't authenticate yet). Invalid/expired tokens throw → root errorComponent.
    await validateCodeVerificationToken({
      data: { token: params.codeVerificationToken },
    });
  },
  component: LoginViaCodePage,
});

function LoginViaCodePage() {
  const { codeVerificationToken } = Route.useParams();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string>();
  const verifyCodeFn = useServerFn(verifyLoginCodeAndAuthenticate);

  const verifyCodeMutation = useToastMutation({
    action: 'Verify login code',
    mutationFn: (variables: { code: string }) =>
      verifyCodeFn({
        data: {
          token: codeVerificationToken,
          code: variables.code.toUpperCase(),
        },
      }),
    onSuccess: () => navigate({ to: '/user-settings' }),
    setFormError,
  });

  const form = useForm({
    defaultValues: {
      code: '',
    },
    validators: {
      onChange: z.object({
        code: z
          .string()
          .length(8, 'Code must be 8 characters')
          .regex(/^[A-Z0-9]{8}$/, 'Code must be alphanumeric (A-Z, 0-9)'),
      }),
    },
    onSubmit: ({ value }) => verifyCodeMutation.mutateAsync({ code: value.code.toUpperCase() }),
  });

  return (
    <AuthLayout title="Enter Verification Code">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          e.stopPropagation();
          await form.handleSubmit();
        }}
      >
        <FieldGroup>
          <form.Field name="code">
            {(field) => (
              <Field data-invalid={field.state.meta.errors.length > 0}>
                <FieldLabel htmlFor={field.name}>Enter the 8-character code sent to your email</FieldLabel>
                <InputOTP
                  maxLength={8}
                  value={field.state.value.toUpperCase()}
                  onChange={(value) => field.handleChange(value.toUpperCase())}
                  disabled={verifyCodeMutation.isPending}
                >
                  <InputOTPGroup>
                    <InputOTPSlot index={0} />
                    <InputOTPSlot index={1} />
                    <InputOTPSlot index={2} />
                    <InputOTPSlot index={3} />
                    <InputOTPSlot index={4} />
                    <InputOTPSlot index={5} />
                    <InputOTPSlot index={6} />
                    <InputOTPSlot index={7} />
                  </InputOTPGroup>
                </InputOTP>
                {field.state.meta.errors.length > 0 && <FieldError>{field.state.meta.errors[0]?.message}</FieldError>}
              </Field>
            )}
          </form.Field>

          {formError && <FieldError>{formError}</FieldError>}

          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <Field>
                <Button type="submit" disabled={!canSubmit || isSubmitting} className="w-full">
                  {isSubmitting ? 'Verifying Code...' : 'Verify Code'}
                </Button>
              </Field>
            )}
          </form.Subscribe>
        </FieldGroup>
      </form>
    </AuthLayout>
  );
}
