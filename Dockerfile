# syntax=docker/dockerfile:1.6
FROM --platform=linux/amd64 node:24-slim AS base

# Omit NODE_ENV=production so devDependencies (e.g. drizzle-kit) are installed for db:init
ENV PNPM_HOME="/pnpm" \
    PATH="$PNPM_HOME:$PATH" \
    PORT=8080 \
    CI=true

RUN npm install -g pnpm@10.17.0

WORKDIR /app

# Copy dependency manifests first so this layer is cacheable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

RUN pnpm fetch --reporter=silent

COPY . .

RUN pnpm install --frozen-lockfile --prefer-offline

RUN pnpm build

# Demo defaults needed during image build and local container runs.
# Passkey origin config is injected at deploy/runtime.
ENV SITE_NAME="Passwordless Login" \
    DATABASE_URL="./db.sqlite"

# Build-time JWT_SECRET so db:init and app can run (override at runtime for a fixed secret)
ARG JWT_SECRET
ENV JWT_SECRET="${JWT_SECRET:-passwordless-login-docker-default-secret-min-32-chars}"

# Initialize SQLite schema (db resets with each new image deploy)
RUN pnpm db:init

# Production mode for the running app
ENV NODE_ENV=production

EXPOSE 8080

# Preload reflect-metadata so TanStack Start / Nitro server functions (tsyringe) work at runtime.
CMD ["node", "--import", "reflect-metadata", "/app/.output/server/index.mjs"]
