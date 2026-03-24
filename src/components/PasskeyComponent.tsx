import { useRouter } from '@tanstack/react-router';
import { useServerFn } from '@tanstack/react-start';
import { startRegistration } from '@simplewebauthn/browser';
import { useCallback, useEffect, useState } from 'react';
import type { UserPasskeyListItem } from '@/server/user';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldSet } from '@/components/ui/field';
import { useToastMutation } from '@/hooks/useToastMutation';
import { toFriendlyWebAuthnError } from '@/lib/webauthnErrors';
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

  const [passkeys, setPasskeys] = useState<UserPasskeyListItem[] | undefined>(undefined);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const refetchPasskeys = useCallback(async () => {
    try {
      const list = await getUserPasskeysFn({ data: { userId } });
      setPasskeys(list);
      setLoadError(null);
    } catch (err) {
      setLoadError(err instanceof Error ? err : new Error('Failed to load passkeys.'));
      setPasskeys([]);
    }
  }, [getUserPasskeysFn, userId]);

  useEffect(() => {
    void refetchPasskeys();
  }, [refetchPasskeys]);

  // Mutation for adding a passkey
  const addPasskeyMutation = useToastMutation({
    action: 'Passkey registration',
    mutationFn: async () => {
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

      const registrationResponse = await startRegistration({
        optionsJSON: result.options,
      }).catch((err) => {
        throw toFriendlyWebAuthnError(err, 'register');
      });

      await verifyRegistrationResponseFn({
        data: {
          response: registrationResponse,
          userId,
          token: result.token,
        },
      });
    },
    onSuccess: async () => {
      await refetchPasskeys();
      void router.invalidate();
    },
  });

  // Mutation for deleting a passkey
  const deletePasskeyMutation = useToastMutation({
    action: 'Passkey deletion',
    mutationFn: async (passkeyId: number) => {
      return await deletePasskeyFn({ data: { userId, passkeyId } });
    },
    onSuccess: async () => {
      await refetchPasskeys();
      void router.invalidate();
    },
  });

  const handleAddPasskey = () => {
    addPasskeyMutation.mutate();
  };

  const handleDeletePasskey = (passkey: UserPasskeyListItem) => {
    deletePasskeyMutation.mutate(passkey.id);
  };

  const passkeyList = passkeys ?? [];
  const hasPasskeys = passkeyList.length > 0;
  const isLoading = addPasskeyMutation.isPending || deletePasskeyMutation.isPending;
  const isInitialLoad = passkeys === undefined;

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
          {loadError && <FieldError className="mb-4">{loadError.message}</FieldError>}

          <Field>
            <Button onClick={handleAddPasskey} disabled={isLoading || isInitialLoad}>
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

            {passkeyList.map((passkey) => {
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
