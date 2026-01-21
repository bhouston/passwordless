import { useForm } from '@tanstack/react-form';
import { createFileRoute, useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { useState } from 'react';
import { z } from 'zod';
import { PasskeyComponent } from '@/components/PasskeyComponent';
import { Button } from '@/components/ui/button';
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet } from '@/components/ui/field';
import { useToastMutation } from '@/hooks/useToastMutation';
import { Input } from '@/components/ui/input';
import { updateUserName } from '@/server/user';

const userDetailsSchema = z.object({
  name: z.string().min(3, 'Name is required').max(100, 'Name is too long'),
});

type UserDetailsFormData = z.infer<typeof userDetailsSchema>;

export const Route = createFileRoute('/_authed/user-settings')({
  component: UserSettingsPage,
});

function UserSettingsPage() {
  const { sessionUser } = Route.useRouteContext();
  const router = useRouter();
  const updateUserNameFn = useServerFn(updateUserName);
  const [formError, setFormError] = useState<string>();

  const updateNameMutation = useToastMutation({
    action: 'Profile update',
    setFormError,
    mutationFn: async (data: UserDetailsFormData) => {
      const result = await updateUserNameFn({ data });
      if (!result.success) {
        throw new Error('Failed to update user name');
      }
      return result;
    },
    onSuccess: async (result) => {
      form.setFieldValue('name', result.user.name);
      await router.invalidate();
    },
  });

  const form = useForm({
    defaultValues: {
      name: sessionUser.name,
    },
    validators: {
      onChange: userDetailsSchema,
    },
    onSubmit: async ({ value }) => {
      await updateNameMutation.mutateAsync(value);
    },
  });

  return (
    <div className="w-full flex-1 min-h-0 bg-background p-4">
      <div className="page-wrap max-w-4xl py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold text-foreground">User Settings</h1>
          <p className="text-muted-foreground">Manage your account settings and preferences</p>
        </div>

        <div className="space-y-6">
          <div className="border border-border bg-card p-6">
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-semibold text-foreground">User Details</h2>
              <p className="text-sm text-muted-foreground">Update your personal information</p>
            </div>

            <FieldSet>
              <FieldGroup>
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
                            type="text"
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(e) => field.handleChange(e.target.value)}
                            aria-invalid={field.state.meta.errors.length > 0}
                            placeholder="Your name"
                          />
                          <FieldDescription>Your display name</FieldDescription>
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
                        disabled={form.state.isSubmitting || updateNameMutation.isPending || !form.state.isFormValid}
                      >
                        {form.state.isSubmitting || updateNameMutation.isPending ? 'Saving...' : 'Save'}
                      </Button>
                    </Field>
                  </FieldGroup>
                </form>
              </FieldGroup>
            </FieldSet>
          </div>

          <PasskeyComponent userId={sessionUser.id} userName={sessionUser.email} userDisplayName={sessionUser.name} />
        </div>
      </div>
    </div>
  );
}
