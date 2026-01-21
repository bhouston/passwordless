import { useQuery } from '@tanstack/react-query';
import { useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import type { UserPasskeyListItem } from '@/server/user';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldSet } from '@/components/ui/field';
import { useToastMutation } from '@/hooks/useToastMutation';
import { startPasskeyRegistration } from '@/lib/webauthnClient';
import { deletePasskey, generateRegistrationOptions, verifyRegistrationResponse } from '@/server/passkey';
import { getUserPasskeys } from '@/server/user';

interface PasskeyComponentProps {
  userId: number;
  userName: string;
  userDisplayName: string;
}

function getPasskeyLabel(passkey: UserPasskeyListItem) {
  if (passkey.name) {
    return passkey.name;
  }

  return passkey.authenticatorType === 'platform' ? 'Platform Passkey' : 'Cross-Platform Passkey';
}

function formatPasskeyDate(dateString: string | null) {
  if (!dateString) {
    return null;
  }

  const parsedDate = new Date(dateString);
  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(parsedDate);
}

export function PasskeyComponent({ userId, userName, userDisplayName }: PasskeyComponentProps) {
  const router = useRouter();
  const generateRegistrationOptionsFn = useServerFn(generateRegistrationOptions);
  const verifyRegistrationResponseFn = useServerFn(verifyRegistrationResponse);
  const deletePasskeyFn = useServerFn(deletePasskey);
  const getUserPasskeysFn = useServerFn(getUserPasskeys);

  const passkeysQuery = useQuery({
    queryKey: ['PASSKEYS', userId],
    queryFn: async () => getUserPasskeysFn({ data: { userId } }),
  });

  // Mutation for adding a passkey
  const addPasskeyMutation = useToastMutation({
    action: 'Passkey registration',
    queryKey: ['PASSKEYS', userId],
    mutationFn: async () => {
      try {
        const result = await generateRegistrationOptionsFn({
          data: {
            userId,
            userName,
            userDisplayName,
          },
        });

        if (!result.options || !result.token) {
          throw new Error('Failed to generate registration options');
        }

        const registrationResponse = await startPasskeyRegistration({
          optionsJSON: result.options,
        });

        const verification = await verifyRegistrationResponseFn({
          data: {
            response: registrationResponse,
            userId,
            token: result.token,
          },
        });

        if (!verification.success) {
          throw new Error(verification.error || 'Failed to register passkey');
        }

        return verification;
      } catch (err) {
        if (err instanceof Error) {
          if (
            err.message.includes('cancelled') ||
            err.message.includes('abort') ||
            err.message.includes('NotAllowedError')
          ) {
            throw new Error('Registration cancelled', { cause: err });
          }
          if (err.message.includes('NotSupportedError')) {
            throw new Error('Passkeys are not supported on this device or browser', { cause: err });
          }
        }
        throw err;
      }
    },
    onSuccess: async () => {
      void router.invalidate();
    },
  });

  // Mutation for deleting a passkey
  const deletePasskeyMutation = useToastMutation({
    action: 'Passkey deletion',
    queryKey: ['PASSKEYS', userId],
    mutationFn: async (passkeyId: number) => {
      return await deletePasskeyFn({ data: { userId, passkeyId } });
    },
    onSuccess: async () => {
      void router.invalidate();
    },
  });

  const handleAddPasskey = () => {
    addPasskeyMutation.mutate();
  };

  const handleDeletePasskey = (passkey: UserPasskeyListItem) => {
    deletePasskeyMutation.mutate(passkey.id);
  };

  const passkeys = passkeysQuery.data ?? [];
  const hasPasskeys = passkeys.length > 0;
  const isLoading = addPasskeyMutation.isPending || deletePasskeyMutation.isPending;
  const isInitialLoad = passkeysQuery.isPending && !passkeysQuery.data;

  return (
    <div className="border border-border bg-card p-6">
      <div className="mb-6">
        <h2 className="mb-2 text-2xl font-semibold text-foreground">Passkey Management</h2>
        <p className="text-sm text-muted-foreground">
          Manage the passkeys on your account. Labels are inferred from the browser and operating system that created
          them.
        </p>
      </div>

      <FieldSet>
        <FieldGroup>
          {passkeysQuery.isError && (
            <FieldError className="mb-4">
              {passkeysQuery.error instanceof Error ? passkeysQuery.error.message : 'Failed to load passkeys.'}
            </FieldError>
          )}

          <Field>
            <Button onClick={handleAddPasskey} disabled={isLoading || passkeysQuery.isPending}>
              {addPasskeyMutation.isPending ? 'Registering...' : hasPasskeys ? 'Add Passkey' : 'Add Your First Passkey'}
            </Button>
          </Field>

          <div className="space-y-3">
            {!isInitialLoad && hasPasskeys && (
              <div>
                <h3 className="text-base font-medium text-foreground">Registered passkeys</h3>
              </div>
            )}

            {isInitialLoad && (
              <div className="border border-dashed border-border p-4 text-sm text-muted-foreground">
                Loading passkeys...
              </div>
            )}

            {!isInitialLoad && !hasPasskeys && (
              <div className="border border-dashed border-border p-4 text-sm text-muted-foreground">
                No passkeys registered yet. Add one to see which browser and operating system created it.
              </div>
            )}

            {passkeys.map((passkey) => {
              const createdAt = formatPasskeyDate(passkey.createdAt);
              const lastUsedAt = formatPasskeyDate(passkey.lastUsedAt);

              return (
                <div
                  key={passkey.id}
                  className="flex flex-col gap-4 border border-border p-4 sm:flex-row sm:items-start sm:justify-between"
                >
                  <div className="space-y-1">
                    <p className="font-medium text-foreground">{getPasskeyLabel(passkey)}</p>
                    <p className="text-sm text-muted-foreground">
                      Type: {passkey.authenticatorType === 'platform' ? 'Platform passkey' : 'Cross-platform passkey'}
                    </p>
                    {createdAt && <p className="text-sm text-muted-foreground">Created: {createdAt}</p>}
                    {lastUsedAt && <p className="text-sm text-muted-foreground">Last used: {lastUsedAt}</p>}
                  </div>
                  <Button
                    onClick={() => handleDeletePasskey(passkey)}
                    disabled={isLoading}
                    variant="outline"
                    className="sm:self-center"
                  >
                    {deletePasskeyMutation.isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                </div>
              );
            })}
          </div>
        </FieldGroup>
      </FieldSet>
    </div>
  );
}
