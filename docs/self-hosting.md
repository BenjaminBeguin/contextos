# Self-hosting

Memmo is a pnpm monorepo: `apps/landing`, `apps/web`, `apps/api`, `apps/cli`, and
`packages/shared`, backed by Postgres + Redis.

## Prerequisites

- Node.js 20+ (developed on 24), pnpm 10+
- Postgres 16 and Redis (Docker Compose provides both)

## Run it

```shell
docker compose up -d          # Postgres :5455, Redis :6380
pnpm install                  # also regenerates the Prisma client (postinstall)
cp .env.example .env
pnpm db:migrate               # apply migrations
pnpm db:seed                  # dev user + sample data
pnpm dev                      # landing :3007 · web :3009 · api :3008
```

`pnpm dev` and `pnpm start:api` regenerate the Prisma client first, so a pulled
schema change can't leave the API on a stale client.

## Configuration (`.env`)

| Var | Purpose |
| --- | --- |
| `DATABASE_URL`, `REDIS_URL` | datastores |
| `JWT_SECRET` | session cookie signing |
| `CORS_ORIGINS` | allowed web/landing origins |
| `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` | GitHub OAuth (primary sign-in) |
| `ALLOW_DEV_LOGIN` | email-only dev login (auto-off in production) |
| `ANTHROPIC_API_KEY` / `ALLOW_GLOBAL_LLM` | fallback LLM key (workspaces BYOK by default) |
| `SUPERADMIN_EMAILS` | comma-separated emails that can access `/admin` |
| `STRIPE_SECRET_KEY` | enables self-serve billing checkout (optional) |

## Migrations

Schema changes ship as SQL under `prisma/migrations/`. Apply with `pnpm db:migrate`
(dev) or `pnpm db:deploy` (prod). Always run after pulling a schema change, then
restart the API.

## Verify

```shell
bash scripts/verify.sh        # DB → API → MCP retrieval → isolation
pnpm test                     # unit tests
pnpm docs:api                 # refresh docs/api-reference.md
```

See [DEPLOY.md](../DEPLOY.md) for platform-specific (Railway) deployment.
