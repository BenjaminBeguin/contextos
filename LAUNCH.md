# Memmo — Launch Checklist

Everything that needs *your* accounts, prepared so each step is copy-paste.
Status legend: ☐ = you do it · ✅ = done in-repo.

---

## 1. Reserve the npm package name (do this first — scarcest asset)

The CLI package is named **`memmo`** (unscoped) and the name is currently free.
Reserve it before anyone else.

**Publish order matters** — the CLI bundles `@memmo/shared`, so build the
workspace first:

```bash
pnpm install
pnpm --filter @memmo/shared build      # dependency of the CLI bundle
cd apps/cli
npm login                              # your npm account
npm publish                            # runs prepublishOnly (typecheck + build) automatically
```

- ✅ `package.json` is publish-ready: name, version `0.6.0`, `bin`, `files`,
  `publishConfig.access=public`, MIT `license` + `LICENSE` file, `homepage`,
  `author`, keywords.
- ✅ `.npmignore` added so the built `dist/` actually ships (npm was falling
  back to the repo `.gitignore`, which excludes `dist/` — this is fixed).
- ✅ Verified tarball contents: `LICENSE`, `README.md`, `dist/index.js`,
  `package.json` (4 files, ~21 kB). Confirm anytime with:
  ```bash
  cd apps/cli && npm pack --dry-run
  ```
- If you only want to *reserve* the name now and iterate later, publish as-is
  (`0.6.0`) or bump to a placeholder and republish real bits before launch.

---

## 2. Register the domain

- ☐ **`memmo.dev`** — verified **available** (primary). Register at
  [Cloudflare Registrar](https://dash.cloudflare.com) or
  [Porkbun](https://porkbun.com) (~$12–14/yr, at cost). `.dev` is HTTPS-only
  (HSTS preload) — good.
- Defensive holds (optional, all verified available at time of writing):
  - `.com`: **memmohq.com**, **usememmo.com**, **memmoai.com**
    (bare `memmo.com` is taken — Memmo.me, a Swedish video-shoutout company)
  - `.dev`: getmemmo.dev, memmohq.dev, trymemmo.dev, usememmo.dev
  - `.app`: getmemmo.app, memmohq.app  (bare `memmo.app` is taken)
  - `memmo.ai` is taken.

Re-check availability just before buying:
```bash
curl -s -o /dev/null -w "%{http_code}\n" https://pubapi.registry.google/rdap/domain/memmo.dev   # 404 = free
```

---

## 3. GitHub org / handle

- ☐ `github.com/memmo` is **taken** (a dormant account). Use a variant org for
  the public repo — all verified free: **`memmohq`** (recommended), `getmemmo`,
  `memmoai`, `trymemmo`, `usememmo`.
- When you create the public repo, add a `repository` field to
  `apps/cli/package.json` so the npm page links to it.

---

## 4. Trademark diligence (before filing / heavy spend)

Findings from a preliminary search — **not legal advice**:

- **No blocking "Memmo" trademark in software** found. The closest,
  **MEMOTECHAI** (Memotech AI, LLC), was filed 2019 and **abandoned in 2022**.
- The `.com` holder **Memmo.me** is a Swedish personalized-video company —
  different Nice class (entertainment, not dev tools), so low conflict risk.
- The AI-memory category is **crowded with phonetic neighbors**: Mem0, Memco,
  Memori, Mem, MemMachine. Not legal blockers, but worth a real clearance
  search and a differentiated visual identity.

Do before committing budget:
- ☐ USPTO search — <https://tmsearch.uspto.gov> — "Memmo", classes **9**
  (software) & **42** (SaaS).
- ☐ EUIPO search — <https://euipo.europa.eu/eSearch> — same.
- ☐ Consider a quick clearance opinion from a TM attorney given the crowded
  category.

---

## 5. Deploy the app

See `DEPLOY.md` (API on Railway + Postgres, web/landing on Vercel, env vars,
MCP connector check). The multi-provider BYOK key and "Test connection" are
already wired.

---

## Status of the code side (all done)

- ✅ Rebrand Cortex → Memmo (whole codebase; `git grep` clean)
- ✅ Landing + web tagline: "Long-term memory for AI coding agents"
- ✅ Provider-agnostic BYOK: Anthropic / OpenAI / Google / Custom
- ✅ "Test connection" before saving a provider
- ✅ CLI publish hygiene (clean `dist`, `.npmignore`, `LICENSE`)
