import { createFileRoute, Link, redirect } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/')({
  beforeLoad: ({ context }) => {
    if (context.sessionUser) {
      throw redirect({ to: '/user-settings' });
    }
  },
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex w-full flex-1 min-h-0 flex-col bg-background text-foreground">
      <div className="page-wrap py-16 md:py-24">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Live demo</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08]">
          Passwordless user accounts
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          A real-world sample of production-style authentication:{' '}
          <strong className="font-medium text-foreground">passkeys</strong> (WebAuthn) for day-to-day login, with{' '}
          <strong className="font-medium text-foreground">email one-time codes</strong> as a reliable backup when a
          passkey is not available.
        </p>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Private keys stay on the device; the browser binds credentials to your site, which improves phishing
          resistance compared to passwords alone.
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link to="/signup">Sign up</Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link to="/login">Login</Link>
          </Button>
        </div>

        <div className="mt-16 grid gap-4 border border-border bg-card p-6 md:grid-cols-3 md:gap-6">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Passkeys</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Register and login with WebAuthn—biometrics or device PIN, no password to reuse or leak.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Email OTP backup</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Request a time-limited code in email when you need a fallback path that still avoids static passwords.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Enumeration-safe flows</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Designed so obvious “does this email exist?” signals are avoided where the demo implements those patterns.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
