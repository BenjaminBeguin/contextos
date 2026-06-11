# API container for Cortex (apps/api). Builds the whole pnpm workspace so
# @cortex/shared and the Prisma client resolve, then runs the API with tsx.
# Frontends (landing, web) deploy to Vercel and are not built here.
FROM node:24-slim AS base
ENV PNPM_HOME="/pnpm" PATH="/pnpm:$PATH"
RUN corepack enable
# Prisma needs OpenSSL at runtime.
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies (workspace-aware). Dev deps are included so tsx + prisma
# CLI are available; install happens before NODE_ENV=production is set.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* tsconfig.base.json ./
COPY prisma ./prisma
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --no-frozen-lockfile

# Generate the Prisma client.
RUN pnpm db:generate

ENV NODE_ENV=production
EXPOSE 3008

# Apply pending migrations, then start the API. Railway injects PORT + secrets.
CMD ["sh", "-c", "pnpm db:deploy && pnpm start:api"]
