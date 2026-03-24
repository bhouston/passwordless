import { createFileRoute, Link } from '@tanstack/react-router';
import { Button } from '@/components/ui/button';

export const Route = createFileRoute('/_nonauthed/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex w-full flex-1 min-h-0 flex-col bg-background text-foreground">
      <div className="page-wrap py-16 md:py-24">
        <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">Live demo</p>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-foreground md:text-5xl md:leading-[1.08]">
          Creating a passwordless login system
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          Passwords are a shared-secret liability. This demo shows a modern passwordless flow that uses{' '}
          <strong className="font-medium text-foreground">email OTP to establish identity</strong> and{' '}
          <strong className="font-medium text-foreground">WebAuthn passkeys to authenticate</strong>.
        </p>
        <p className="mt-4 max-w-2xl text-sm text-muted-foreground">
          Private keys stay on-device and are bound to your relying party (`rpId`), which gives stronger phishing
          resistance than password-based login.
        </p>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground">
          Presentation:{' '}
          <a
            href="https://ben3d.xyz/u/plp"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline decoration-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground"
          >
            Creating a Passwordless User System
          </a>
          .
        </p>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Source code:{' '}
          <a
            href="https://github.com/bhouston/passwordless-login"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-foreground underline decoration-foreground/40 underline-offset-4 transition-colors hover:decoration-foreground"
          >
            Passwordless Login Demo
          </a>
          .
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
            <h2 className="text-sm font-semibold text-foreground">Email OTP establishes identity</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Start with username + email, then verify a one-time code. This creates the account identity without
              introducing a password.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Passkeys authenticate</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              Passkeys are browser-native public/private key auth (think SSH keys for the web) with biometrics or a
              device PIN.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">Demo boundaries</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
              This project intentionally skips production hardening such as rate limiting and real email delivery.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
