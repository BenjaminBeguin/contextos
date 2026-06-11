# Deploying Cortex

Three deployables from one monorepo:

| App            | Path           | Host    | Suggested domain        |
| -------------- | -------------- | ------- | ----------------------- |
| Landing        | `apps/landing` | Vercel  | `cortex.dev`         |
| Product app    | `apps/web`     | Vercel  | `app.cortex.dev`     |
| API (+Postgres)| `apps/api`     | Railway | `api.cortex.dev`     |

> **Domain tip:** put the app and API under the **same registrable domain**
> (`app.cortex.dev` + `api.cortex.dev`). The session cookie is set by the
> API and sent on `credentials: "include"` fetches from the app; same-site
> subdomains keep `SameSite=Lax` working. Fully different domains would require
> `SameSite=None` and extra CORS care.

---

## 1. API + Postgres on Railway

The repo ships a root `Dockerfile` (API only, run via `tsx`) and `railway.json`
(Dockerfile builder + `/health` check). It runs `prisma migrate deploy` on every
boot, then starts the server.

1. **New Railway project** → **Add PostgreSQL**. Railway sets `DATABASE_URL` on
   the database service; reference it from the API service.
2. **Add a service from this repo** (GitHub). Railway auto-detects `railway.json`
   and builds the `Dockerfile`.
3. Set the API service **variables**:

   | Variable               | Value                                                        |
   | ---------------------- | ------------------------------------------------------------ |
   | `DATABASE_URL`         | `${{Postgres.DATABASE_URL}}` (Railway reference)             |
   | `NODE_ENV`             | `production`                                                 |
   | `JWT_SECRET`           | a long random string                                         |
   | `API_BASE_URL`         | `https://api.cortex.dev`                                  |
   | `APP_URL`              | `https://app.cortex.dev`                                  |
   | `CORS_ORIGINS`         | `https://cortex.dev,https://app.cortex.dev`            |
   | `GITHUB_CLIENT_ID`     | from your GitHub OAuth app                                   |
   | `GITHUB_CLIENT_SECRET` | from your GitHub OAuth app                                   |
   | `ANTHROPIC_API_KEY`    | optional — enables LLM extraction/docs                       |
   | `ANTHROPIC_MODEL`      | optional (default `claude-sonnet-4-6`)                       |

   Railway injects `PORT`; the server already listens on it.
4. Add the custom domain `api.cortex.dev` to the API service.
5. First deploy runs migrations automatically. To seed (optional, demo data):
   run `pnpm db:seed` once via Railway's shell with `DATABASE_URL` set — **do not
   seed a real production DB** (it creates a fixed dev token).

> `NODE_ENV=production` disables the email/dev login automatically, so GitHub
> OAuth is the only way in.

---

## 2. GitHub OAuth app

Create at <https://github.com/settings/developers> → **New OAuth App**:

- **Homepage URL:** `https://cortex.dev`
- **Authorization callback URL:** `https://api.cortex.dev/auth/github/callback`

Copy the Client ID/Secret into the Railway API variables above. For local dev,
use a second OAuth app with callback `http://localhost:3008/auth/github/callback`.

---

## 3. Landing + Product app on Vercel

Create **two** Vercel projects from the same repo (monorepo).

### Landing (`apps/landing`)
- **Root Directory:** `apps/landing`
- **Framework:** Next.js (auto). Install runs at the workspace root (pnpm).
- **Env:**
  - `NEXT_PUBLIC_API_BASE_URL=https://api.cortex.dev`
  - `NEXT_PUBLIC_APP_URL=https://app.cortex.dev`
- **Domain:** `cortex.dev`

### Product app (`apps/web`)
- **Root Directory:** `apps/web`
- **Framework:** Next.js (auto)
- **Env:** `NEXT_PUBLIC_API_BASE_URL=https://api.cortex.dev`
- **Domain:** `app.cortex.dev`

> If Vercel's pnpm-workspace detection needs help, set the **Install Command** to
> `pnpm install` and enable "Include files outside the root directory" so the
> `@cortex/shared` workspace package resolves.

---

## 4. Post-deploy checklist

- [ ] `https://api.cortex.dev/health` → `{ "ok": true }`
- [ ] `https://api.cortex.dev/stats` → JSON counts (public)
- [ ] Landing loads; waitlist submit returns success and increments the count
- [ ] `app.cortex.dev/login` → "Continue with GitHub" → round-trips to `/dashboard`
- [ ] Create a workspace + repo, approve a memory
- [ ] `CORS_ORIGINS` includes both frontends (no CORS errors in console)
- [ ] CLI: `CORTEX_API_URL=https://api.cortex.dev cortex login`

---

## 5. CLI distribution (separate from hosting)

The MCP onboarding requires publishing `apps/cli` to npm. It publishes as
**`@mxbenjaminbeguin/cortex`** (the `cortex` name is owned by someone else), but the installed
**binary is still `cortex`** (the `bin` key), so `.mcp.json` and all in-app
instructions for the command are unchanged. Users install with:

```bash
npm install -g @mxbenjaminbeguin/cortex
```

To publish:

```bash
pnpm --filter @mxbenjaminbeguin/cortex build
cd apps/cli && npm publish        # bump version first for updates: npm version patch
```

`prepublishOnly` rebuilds first, and `publishConfig.access` is `public`. If
`@mxbenjaminbeguin/cortex` is also unavailable, scope it (e.g. `@your-org/@mxbenjaminbeguin/cortex`) — the binary
stays `cortex`.

Until published, users can run it from the repo: `pnpm --filter @mxbenjaminbeguin/cortex build`
then point `.mcp.json` at the built `dist/index.js`.

---

## Not yet wired (future)

- Redis/BullMQ worker (no async jobs yet).
- Stripe billing (pricing is display-only behind the waitlist).
- Error monitoring (Sentry) and rate limiting on public endpoints.
