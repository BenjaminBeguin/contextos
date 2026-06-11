# Cortex

**Operational memory for AI coding agents.**

Cortex connects to Claude Code and builds a living memory layer for your team:
it captures what agents learn while working, turns it into structured, approved
memory, and injects the right context back into future Claude Code sessions
through the Model Context Protocol (MCP).

---

## Monorepo layout

```
cortex/
├─ apps/
│  ├─ landing/   @cortex/landing   Marketing site, waitlist, 3D core   → :3007
│  ├─ web/       @cortex/web        Product app (dashboard, memory)      → :3009
│  ├─ api/       @cortex/api        Fastify + Prisma REST/MCP API        → :3008
│  └─ cli/       @cortex/cli        CLI + MCP stdio server (`cortex`)
├─ packages/
│  └─ shared/    @cortex/shared     Shared types + zod schemas
├─ prisma/                             schema.prisma · seed.ts
├─ scripts/                            verify.sh · mcp-smoke.mjs
└─ docker-compose.yml                  postgres :5455 · redis :6380
```

Workspaces are managed by pnpm (`apps/*`, `packages/*`); the shared package is
consumed via `workspace:*`.

---

## Prerequisites

- Node.js 20+ (developed on 24)
- pnpm 10+
- Docker (for Postgres + Redis)

## Quick start

```bash
# 1. Start Postgres + Redis
docker compose up -d

# 2. Install dependencies
pnpm install

# 3. Set up the database
cp .env.example .env        # already present in dev
pnpm db:generate            # generate the Prisma client
pnpm db:migrate             # create tables
pnpm db:seed                # dev user, workspaces, sample memories

# 4. Run everything (landing + web + api)
pnpm dev
```

| Service | URL                     |
| ------- | ----------------------- |
| Landing | http://localhost:3007   |
| API     | http://localhost:3008   |
| Web app | http://localhost:3009   |

Seed credentials: log in to the web app with **dev@cortex.dev** (email-only
dev auth). The seed also prints a fixed API token and the Acme/Globex workspace
and repo IDs for local testing.

> Ports are non-default to avoid clashing with a local Postgres/Redis. Override
> via `.env` (`API_PORT`, `CORS_ORIGINS`, `NEXT_PUBLIC_*`) and the `dev` scripts.

---

## Connect Claude Code (the core loop)

From any repo you want to give memory to:

```bash
npm install -g @mxbenjaminbeguin/cortex   # (local dev: pnpm --filter @mxbenjaminbeguin/cortex build)
cortex login              # stores an API token in ~/.cortex
cortex init               # links the repo, writes CLAUDE.md / .mcp.json / hooks
```

> The npm package is published as `@mxbenjaminbeguin/cortex`; the installed
> command is `cortex`.

`init` generates:

```
.cortex/config.json       # repo link
CLAUDE.md                    # agent guidance
.mcp.json                    # registers the cortex MCP server (stdio)
.claude/hooks/*              # session + before-edit hooks (stubs)
```

Open Claude Code in the repo; it discovers the `cortex` MCP server, which
exposes:

- `search_memory(query)` → approved memories for the repo
- `get_repo_context()` → stack, recommended commands, risk warnings
- `record_session_summary(...)` → submit what the agent did; Cortex extracts
  **proposed** memories from it for review

Memory is always scoped to a repo and never leaks across workspaces. Proposed
memories are suggestions until approved in the web app.

### AI memory extraction

When a session is recorded (`POST /repos/:id/sessions` or the MCP tool),
Cortex extracts durable memories from the task/summary/commands/errors:

- With `ANTHROPIC_API_KEY` set, it calls Claude (`ANTHROPIC_MODEL`, default
  `claude-sonnet-4-6`) with a cached system prompt and parses structured JSON.
- Without a key, a deterministic heuristic fallback runs so the loop still works
  offline.

Extracted items land in the repo's inbox as `proposed` memories.

---

## Web app

The product app (`apps/web`) surfaces:

- **Dashboard** — workspaces, join codes, and a GitHub-backed repo picker.
- **Memory** — per-repo library, inbox (review/approve/reject), and inline editing.
- **Sessions** — captured Claude Code sessions and the memories they proposed.
- **Living docs** — Overview / Commands / Risks / Onboarding generated from approved memories (markdown-rendered).
- **Usage** — retrieval counts, 14-day activity, memory status breakdown, top repos.
- **Graph** — an interactive force-directed knowledge graph of repos → memories → sessions.
- **Chat** — ask questions answered from your approved memories (RAG, with source citations).
- **Settings** — rename workspace, members, join-code rotation, GitHub connection, and API tokens.

Public endpoints (`/waitlist`, `/chat`) are rate-limited per IP.

---

## Scripts

| Command            | What it does                                          |
| ------------------ | ----------------------------------------------------- |
| `pnpm dev`         | Run landing + web + api in parallel                   |
| `pnpm build`       | Build all packages                                    |
| `pnpm db:generate` | Generate the Prisma client                            |
| `pnpm db:migrate`  | Run Prisma migrations                                 |
| `pnpm db:seed`     | Seed dev data                                         |
| `bash scripts/verify.sh` | End-to-end check (DB → API → MCP retrieval → isolation) |

---

## Usage analytics

Product usage is tracked in the `UsageEvent` table (MCP retrievals, memory
created/approved). The API exposes:

- `GET /workspaces/:id/metrics` — per-workspace retrievals, memory status
  breakdown, 14-day activity series, top repos (auth required)
- `GET /stats` — public aggregate counts (waitlist, memories tracked) for the
  marketing site

The web app surfaces these on the **Usage** page.

---

## Tech stack

TypeScript everywhere · pnpm workspaces · Next.js 15 + Tailwind v4 ·
React Three Fiber (landing) · Fastify + Prisma + PostgreSQL · MCP SDK ·
Docker Compose for local infra.

## Authentication

- **GitHub OAuth** is the primary sign-in. Register an OAuth app at
  https://github.com/settings/developers with callback
  `http://localhost:3008/auth/github/callback`, then set `GITHUB_CLIENT_ID` and
  `GITHUB_CLIENT_SECRET`. The flow: web → `GET /auth/github/login` → GitHub →
  `GET /auth/github/callback` (token exchange + user upsert + session cookie) →
  redirect to the app.
- **Dev email login** (`POST /auth/login`, no password) is enabled automatically
  outside production for local work and seeding. It is hard-disabled when
  `NODE_ENV=production`; set `ALLOW_DEV_LOGIN=false` to disable it earlier.
- `GET /auth/config` reports which methods are active so the login UI adapts.

## Security model

- Workspace-scoped access: every repo/memory request resolves user → membership
  → workspace; cross-workspace access is rejected (403).
- API tokens for CLI/MCP are stored hashed; raw tokens are shown once.
- Memory changes are written to an `AuditLog`.
- Agent-submitted memories are `proposed` until a human approves them.
```
