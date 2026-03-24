# Creating a Passwordless Login System

Demo application for the March 2026 Forward JS presentation on passwordless logins:

- **Email OTP** to establish account identity
- **Passkeys (WebAuthn)** to authenticate without shared secrets

Live demo: [https://ben3d.xyz/u/pl](https://ben3d.xyz/u/pl)

Presentation: [Creating a Passwordless User System](https://presentations.benhouston3d.com/passwordless-login/1?share=eyJhbGciOiJIUzI1NiJ9.eyJwdXJwb3NlIjoicHJlc2VudGF0aW9uLXNoYXJlIiwicHJlc2VudGF0aW9uU3R1YiI6InBhc3N3b3JkbGVzcy1sb2dpbiIsImlhdCI6MTc3NDM2MzIzNH0.WJmled1hHRFA2NIeB9dKbtCnKIlFm8t_Ti4yMbIs64k)

## Why this exists

Passwords are a shared-secret liability. Even hashed password databases become breach targets, and users still end up juggling weak passwords or password managers.

This project demonstrates a simpler model:

1. User signs up with username + email.
2. App verifies ownership via email one-time code.
3. User registers a passkey.
4. Future logins use passkeys by default (with OTP fallback paths available in the demo).

Passkeys are effectively SSH-style public/private key auth in the browser. Private keys remain on user devices and are scoped to your relying party (`rpId`).

## Stack

- TanStack Start + Router
- React + TypeScript
- Tailwind CSS + shadcn/ui
- SimpleWebAuthn (`@simplewebauthn/browser` and `@simplewebauthn/server`)
- SQLite + Drizzle ORM

## Run locally

```bash
pnpm install
pnpm db:init
pnpm dev
```

The app runs on `http://localhost:3100`.

## Test

```bash
pnpm test
pnpm test:e2e
```

## Important demo caveats

This repository is intended for learning and live demos.

- Do **not** deploy unmodified to production.
- Production hardening is intentionally incomplete (for example: rate limiting).
- Email delivery is simplified for demo flow verification.

## Author

[Ben Houston](https://benhouston3d.com), Sponsored by [Land of Assets](https://landofassets.com)
