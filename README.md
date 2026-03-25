# Creating a Passwordless Login System

Demo application for the March 2026 Forward JS presentation on passwordless logins:

- **Email OTP** to establish account identity
- **Passkeys (WebAuthn)** to authenticate without shared secrets

Links:

- [Live Passwordless Demo](https://ben3d.ca/~pwl)
- [Passwordless Demo Source Code on Github](https://github.com/bhouston/passwordless)
- [Creating a Passwordless User System Presentation](https://ben3d.ca/~pwl-deck)

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

Install sqlite:

```
# MacOS
brew install sqlite

# Linux
sudo apt-get install sqlite3

# Windows
choco install sqlite
```

Run app

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

[Ben Houston](https://ben3d.ca), Sponsored by [Land of Assets](https://landofassets.com)
