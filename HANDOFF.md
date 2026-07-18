# Session Handoff — Memmo

Context for a fresh session to continue seamlessly. Read this first, then
`LAUNCH.md` and `docs/comms-plan.md`.

---

## What this project is

**Memmo** — *long-term memory for AI coding agents*. It captures a team's
operational knowledge (decisions, conventions, risks, lessons) from real agent
sessions and merged PRs, a human approves it, and it's injected back into future
Claude Code sessions over **MCP** — so agents stop starting from zero. Includes a
memory-grounded PR reviewer that learns from accept/dismiss feedback.

- **Monorepo (pnpm):** `apps/api` (Fastify + Prisma), `apps/web` (Next.js product
  app), `apps/landing` (Next.js marketing), `apps/cli` (the `memmo` CLI + MCP
  server), `packages/shared` (zod schemas + shared types, bundled into the CLI).
- **Tagline:** "Long-term memory for AI coding agents."

## Repo / branch state

- Canonical repo is now **`github.com/memmohq/memmo-core`** (migrated from the old
  `benjaminbeguin/contextos` with full history). `memmo-core`'s **`main`** ==
  the work described here.
- If you're in the old `contextos` checkout, the equivalent branch is
  `claude/project-status-review-pj1d7b`; mirror it with
  `git push memmo <branch>:main`.
- Everything below is committed and pushed. All green:
  **5 packages typecheck, 86/86 tests pass**, full monorepo build succeeds.

## What was done this session (newest first)

| Commit | Summary |
|--------|---------|
| `d5ca12c` | CLI `repository`/`bugs` → memmohq/memmo-core |
| `e62f7a3` | `prepublishOnly` builds `@memmo/shared` first (so `npm publish` just works) |
| `3ecc630` | `docs/comms-plan.md` — launch/comms plan |
| `48ddbd7` | CLI publish-ready: MIT `LICENSE`, `.npmignore`, homepage/author + `LAUNCH.md` |
| `8c5355d` | Web `<title>`/description aligned to the tagline |
| `2afe25e` | CLI build cleans `dist/` first (deterministic publishes) |
| `0838186` | **"Test connection"** button — validate a provider before saving |
| `c933abd` | **Provider-agnostic BYOK** — Anthropic / OpenAI / Google / Custom |
| `691ba84` | Landing tagline finalized |
| `f6cb041` | **Rebrand** Cortex/contextos → Memmo (whole codebase) |

### Rebrand (done, verified)
`git grep` for `cortex`/`ctxos`/`contextos`/`mxbenjaminbeguin` is **zero** in the
committed tree. Renamed: npm pkg → `memmo` (unscoped), workspace scope
`@cortex/*` → `@memmo/*`, token prefix `ctxos_` → `memmo_`, config dir `~/.memmo`,
env vars `MEMMO_*`, local Postgres db → `memmo`, MCP server name/command → `memmo`,
generated `CLAUDE.md`/`.mcp.json`. Only stray ref is in gitignored `.env`.

### Provider-agnostic BYOK (done, verified)
- One seam: **`apps/api/src/services/llm.ts`**. `getWorkspaceLlm(workspaceId)`
  returns an `LlmConfig { provider, apiKey, model?, baseUrl? }`; `complete(cfg, …)`
  dispatches: **Anthropic** via native SDK (prompt caching), everything else over
  the **OpenAI-compatible** Chat Completions API via `fetch` (covers OpenAI,
  Google Gemini's compat endpoint, and any Custom base URL — Azure/OpenRouter/
  Together/Groq/local). No new dependency.
- Schema: `Workspace.anthropicKey` → `llmKey` + `llmProvider`, `llmModel`,
  `llmBaseUrl` (migration `prisma/migrations/20260718120000_llm_provider`).
- Routes: `PUT/DELETE /workspaces/:id/llm` (was `/anthropic-key`) +
  `POST /workspaces/:id/llm/test`; `setLlmSchema`/`testLlmSchema` in shared.
- UI: `apps/web/components/ProjectSettings.tsx` → `AiKeyCard` has a provider
  dropdown; **Custom** reveals base URL + model; a **Test** button hits `/llm/test`.
- **Kept at project level** (not org-level) per product decision.

## Todo — needs the owner's accounts (see `LAUNCH.md` for exact commands)

1. **npm** — reserve `memmo` (free). `pnpm install && pnpm --filter @memmo/shared
   build`, then `cd apps/cli && npm publish`. (prepublishOnly now handles the
   shared build too.) *Status: may already be done — check `npm view memmo`.*
2. **Domain** — register **`memmo.dev`** (verified free). Defensive `.com`s free:
   `memmohq.com`, `usememmo.com`, `memmoai.com`. (`memmo.com`/`.ai` taken by an
   unrelated video co.)
3. **GitHub org** — `memmohq` created; repo `memmo-core` live. ✅
4. **Merge** — get `main` reviewed; open a PR if desired.
5. **Deploy** — `DEPLOY.md` (Railway API+Postgres, Vercel web/landing).
6. **Trademark** — USPTO/EUIPO "Memmo" classes 9 & 42. No blocker found
   (MEMOTECHAI abandoned 2022); crowded category (Mem0/Memco/Memori) → clearance
   search advised.
7. **Launch** — demo video, analytics funnel, then run `docs/comms-plan.md`
   (Show HN + Product Hunt + waitlist email drafts are ready).

## Gotchas / conventions

- **Build order:** `@memmo/shared` must be built before the CLI or web typecheck
  (it's a workspace dep). `pnpm install && pnpm --filter @memmo/shared build`.
- **Verify before committing:** `pnpm test` (vitest, 86 tests) and per-package
  `tsc`/`build`. There's a runtime LLM-dispatch smoke pattern in the c933abd/
  0838186 work if you need it.
- **`.env`** is gitignored; local DB is now `memmo` (recreate the Docker volume
  if running locally).
- **Commit trailers** used this session: `Co-Authored-By: Claude …` +
  `Claude-Session: …`. Do NOT put the model identifier in commits/PRs/code.
- **This session's environment reset the container repeatedly**, reverting local
  to a stale commit while keeping edits — always `git fetch && git reset --hard
  origin/<branch>` and rebuild `@memmo/shared` before trusting local state.
