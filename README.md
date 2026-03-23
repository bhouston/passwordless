# Passwordless login demo

This is a small demo app that shows **passwordless authentication** using **WebAuthn passkeys** as the main path and **email one-time codes** as a backup. Use the source for implementation details.

## Technology Stack

- TanStack Start + Router for web site
- TailwindCSS + ShadCN for components and styling
- TanStack Form to manage forms.
- SimpleWebAuthn for Passkeys

## Run the app

First time (install dependencies and initialize the local database):

```bash
pnpm install
pnpm db:init   # initializes local SQLite database
pnpm dev       # start dev server
```

## Tests

```bash
pnpm test      # Vitest (unit / integration)
pnpm test:e2e  # end-to-end (builds the app, starts a server, runs Playwright)
```

## Author

[Ben Houston](https://benhouston3d.com), Sponsored by [Land of Assets](https://landofassets.com)
