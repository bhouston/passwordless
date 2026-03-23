# Passwordless login demo

This is a small demo app that shows **passwordless authentication** using **WebAuthn passkeys** as the main path and **email one-time codes** as a backup. Use the source for implementation details.

## Run the app

First time (install dependencies and initialize the local database):

```bash
pnpm install
pnpm db:init # initializes a local sqlite database (requires sqlite to be installed and available on the path)
```

Start the dev server:

```bash
pnpm dev
```

## Tests

```bash
pnpm test      # Vitest (unit / integration)
pnpm test:e2e  # end-to-end (builds the app, starts a server, runs Playwright)
```

## Author

[Ben Houston](https://benhouston3d.com), Sponsored by [Land of Assets](https://landofassets.com)
