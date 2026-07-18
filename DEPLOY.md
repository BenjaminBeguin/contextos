# Deploying Memmo

Three deployables from one monorepo:

| App            | Path           | Host    | Suggested domain        |
| -------------- | -------------- | ------- | ----------------------- |
| Landing        | `apps/landing` | Vercel  | `memmo.dev`         |
| Product app    | `apps/web`     | Vercel  | `app.memmo.dev`     |
| API (+Postgres)| `apps/api`     | Railway | `api.memmo.dev`     |

> **Domain tip:** put the app and API under the **same registrable domain**
> (`app.memmo.dev` + `api.memmo.dev`). The session cookie is set by the
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
   | `API_BASE_URL`         | `https://api.memmo.dev`                                  |
   | `APP_URL`              | `https://app.memmo.dev`                                  |
   | `CORS_ORIGINS`         | `https://memmo.dev,https://app.memmo.dev`            |
   | `GITHUB_CLIENT_ID`     | from your GitHub OAuth app                                   |
   | `GITHUB_CLIENT_SECRET` | from your GitHub OAuth app                                   |
   | `ANTHROPIC_API_KEY`    | optional — enables LLM extraction/docs/scan                  |
   | `ANTHROPIC_MODEL`      | optional (default `claude-sonnet-4-6`)                       |
   | `ENCRYPTION_KEY`       | recommended — long random, **different** from `JWT_SECRET`. Encrypts BYOK Anthropic keys + external-DB creds. Falls back to `JWT_SECRET` if unset; rotating it invalidates those stored secrets |
   | `SUPERADMIN_EMAILS`    | optional — comma-separated emails that can reach `/admin`    |
   | `STRIPE_SECRET_KEY` `STRIPE_WEBHOOK_SECRET` `STRIPE_PRICE_TEAM` `STRIPE_PRICE_BUSINESS` | optional — self-serve billing (see §5) |

   Railway injects `PORT`; the server already listens on it. Generate secrets
   with `openssl rand -hex 32` (a distinct value for `JWT_SECRET` and
   `ENCRYPTION_KEY`).
4. Add the custom domain `api.memmo.dev` to the API service.
5. First deploy runs migrations automatically. To seed (optional, demo data):
   run `pnpm db:seed` once via Railway's shell with `DATABASE_URL` set — **do not
   seed a real production DB** (it creates a fixed dev token).

> `NODE_ENV=production` disables the email/dev login automatically, so GitHub
> OAuth is the only way in.

---

## 2. GitHub OAuth app

Create at <https://github.com/settings/developers> → **New OAuth App**:

- **Homepage URL:** `https://memmo.dev`
- **Authorization callback URL:** `https://api.memmo.dev/auth/github/callback`

Copy the Client ID/Secret into the Railway API variables above. For local dev,
use a second OAuth app with callback `http://localhost:3008/auth/github/callback`.

---

## 3. Landing + Product app on Vercel

Create **two** Vercel projects from the same repo (monorepo).

### Landing (`apps/landing`)
- **Root Directory:** `apps/landing`
- **Framework:** Next.js (auto). Install runs at the workspace root (pnpm).
- **Env:**
  - `NEXT_PUBLIC_API_BASE_URL=https://api.memmo.dev`
  - `NEXT_PUBLIC_APP_URL=https://app.memmo.dev`
- **Domain:** `memmo.dev`

### Product app (`apps/web`)
- **Root Directory:** `apps/web`
- **Framework:** Next.js (auto)
- **Env:** `NEXT_PUBLIC_API_BASE_URL=https://api.memmo.dev`
- **Domain:** `app.memmo.dev`

> If Vercel's pnpm-workspace detection needs help, set the **Install Command** to
> `pnpm install` and enable "Include files outside the root directory" so the
> `@memmo/shared` workspace package resolves.

---

## 4. Post-deploy checklist

- [ ] `https://api.memmo.dev/health` → `{ "ok": true }`
- [ ] `https://api.memmo.dev/stats` → JSON counts (public)
- [ ] Landing loads; waitlist submit returns success and increments the count
- [ ] `app.memmo.dev/login` → "Continue with GitHub" → round-trips to `/dashboard`
- [ ] Create a workspace + repo, approve a memory
- [ ] `CORS_ORIGINS` includes both frontends (no CORS errors in console)
- [ ] CLI: `MEMMO_API_URL=https://api.memmo.dev memmo login`
- [ ] Hosted MCP connector: a project's **Settings → Setup → Connect Claude Code
      → Generate connector command**, run it in Claude Code, then `/mcp` shows
      `memmo` connected (the remote endpoint is `POST https://api.memmo.dev/mcp`)

---

## 5. Stripe billing (optional)

Self-serve checkout + webhook are built. Without the `STRIPE_*` vars, plans are
changed via the admin comp / request-upgrade flow instead.

1. Create a **Product + recurring Price** per paid plan in Stripe; put the price
   IDs in `STRIPE_PRICE_TEAM` / `STRIPE_PRICE_BUSINESS` (or set them in the admin
   UI, which overrides env).
2. Add a **webhook endpoint** → `POST https://api.memmo.dev/billing/webhook`,
   subscribing to `checkout.session.completed`,
   `customer.subscription.updated`, `customer.subscription.deleted`.
3. Set `STRIPE_SECRET_KEY` and the webhook signing secret in
   `STRIPE_WEBHOOK_SECRET`.

---

## 6. CLI distribution (separate from hosting)

The MCP onboarding requires publishing `apps/cli` to npm. It publishes as
**`memmo`** (the `memmo` name is owned by someone else), but the installed
**binary is still `memmo`** (the `bin` key), so `.mcp.json` and all in-app
instructions for the command are unchanged. Users install with:

```bash
npm install -g memmo
```

To publish:

```bash
pnpm --filter memmo build
cd apps/cli && npm publish        # bump version first for updates: npm version patch
```

`prepublishOnly` rebuilds first, and `publishConfig.access` is `public`. If
`memmo` is also unavailable, scope it (e.g. `@your-org/memmo`) — the binary
stays `memmo`.

Until published, users can run it from the repo: `pnpm --filter memmo build`
then point `.mcp.json` at the built `dist/index.js`.

---

## Not yet wired (future)

- Redis/BullMQ worker (no async jobs yet — Redis in `docker-compose.yml` is unused).
- Remote MCP connector **OAuth**: the hosted connector (`/mcp`) authenticates
  with an API token in the `Authorization` header today (works via
  `claude mcp add --transport http … --header`). OAuth — needed for the
  claude.ai "Add custom connector" URL-only dialog — is not built yet.
- Error monitoring (Sentry) and rate limiting on public endpoints.
