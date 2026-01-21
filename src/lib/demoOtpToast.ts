import { toast } from 'sonner';

export type DemoOtpType = 'signup-otp' | 'login-otp';

/**
 * Fetches the last OTP for the given type and email from `/api/otp-latest` and shows it in a Sonner toast.
 * No-ops when the response is not ok or no code is returned.
 */
export async function showLastOtpToast(type: DemoOtpType, email: string): Promise<void> {
  const res = await fetch(`/api/otp-latest?type=${type}&email=${encodeURIComponent(email)}`);
  if (!res.ok) {
    return;
  }
  const data = (await res.json()) as { code?: string };
  if (!data.code) {
    return;
  }
  const code = data.code;
  toast.success('Demo: your code', {
    description: code,
    duration: 10_000,
    action: {
      label: 'Copy',
      onClick: () => {
        void navigator.clipboard.writeText(code).then(() => {
          toast.success('Copied to clipboard');
        });
      },
    },
  });
}
