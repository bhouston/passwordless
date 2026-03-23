import { useForm } from '@tanstack/react-form';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { useToastMutation } from '@/hooks/useToastMutation';
import { showLastOtpToast } from '@/lib/demoOtpToast';
import { requestSignupOTP } from '@/server/auth';

// Zod schema for form validation
const signupSchema = z.object({
  name: z.string().min(3, 'Name is required').max(100, 'Name is too long'),
  email: z.email('Please enter a valid email address'),
});

export const Route = createFileRoute('/_nonauthed/signup')({
  component: SignupPage,
});

function SignupPage() {
  const navigate = useNavigate();
  const requestSignupOTPFn = useServerFn(requestSignupOTP);
  const [formError, setFormError] = useState<string>();

  const signupMutation = useToastMutation({
    action: 'Request signup code',
    toastSuccess: false, // Don't show toast since we're navigating
    mutationFn: (variables: { name: string; email: string }) => requestSignupOTPFn({ data: variables }),
    onSuccess: async ({ token }, variables) => {
      await navigate({
        to: '/signup-verify/$signupToken',
        params: { signupToken: token },
      });
      // for demo purposes, show the last OTP in a toast
      await showLastOtpToast('signup-otp', variables.email);
    },
    setFormError,
  });

  const form = useForm({
    defaultValues: {
      name: '',
      email: '',
    },
    validators: {
      onChange: signupSchema,
    },
    onSubmit: ({ value }) => signupMutation.mutateAsync(value),
  });

  return (
    <div className="flex w-full flex-1 min-h-0 items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <FieldSet className="border border-border bg-card p-6">
          <FieldGroup>
            <div className="mb-4">
              <h1 className="mb-2 text-3xl font-bold text-foreground">Create Account</h1>
              <p className="text-muted-foreground">Enter your information to get started</p>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                form.handleSubmit();
              }}
            >
              <FieldGroup>
                <form.Field name="name">
                  {(field) => (
                    <Field data-invalid={field.state.meta.errors.length > 0}>
                      <FieldLabel htmlFor={field.name}>Name</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        aria-invalid={field.state.meta.errors.length > 0}
                        placeholder="John Doe"
                      />
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
                      )}
                    </Field>
                  )}
                </form.Field>

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
                        placeholder="john@example.com"
                      />
                      <FieldDescription>We'll send you a verification code to this email address</FieldDescription>
                      {field.state.meta.errors.length > 0 && (
                        <FieldError>{field.state.meta.errors[0]?.message}</FieldError>
                      )}
                    </Field>
                  )}
                </form.Field>

                {formError && <FieldError>{formError}</FieldError>}

                <Field>
                  <Button
                    type="submit"
                    disabled={form.state.isSubmitting || signupMutation.isPending}
                    className="w-full"
                  >
                    {form.state.isSubmitting || signupMutation.isPending ? 'Sending Code...' : 'Sign Up'}
                  </Button>
                </Field>

                <div className="text-center text-sm text-muted-foreground">
                  Already have an account?{' '}
                  <Link
                    className="font-medium text-foreground underline decoration-foreground/40 underline-offset-4 hover:decoration-foreground"
                    to="/login"
                  >
                    Log in
                  </Link>
                </div>
              </FieldGroup>
            </form>
          </FieldGroup>
        </FieldSet>
      </div>
    </div>
  );
}
