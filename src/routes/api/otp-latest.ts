import { createFileRoute } from '@tanstack/react-router';
import { getLastTestOtp } from '@/server/testOtp';
import type { TestOtpEventType } from '@/server/testOtp';
import { z } from 'zod';

const emailParamSchema = z.string().min(1, 'Email is required').email('Invalid email');

export const Route = createFileRoute('/api/otp-latest')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const type = url.searchParams.get('type') as TestOtpEventType | null;
        if (type !== 'signup-otp' && type !== 'login-otp') {
          return new Response(JSON.stringify({ error: 'Missing or invalid type (signup-otp | login-otp)' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const emailRaw = url.searchParams.get('email');
        const emailResult = emailParamSchema.safeParse(emailRaw ?? '');
        if (!emailResult.success) {
          return new Response(JSON.stringify({ error: 'Missing or invalid email (required for multi-user demo)' }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          });
        }
        const email = emailResult.data;
        const payload = getLastTestOtp(type, email);
        return new Response(JSON.stringify(payload ?? {}), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    },
  },
});
