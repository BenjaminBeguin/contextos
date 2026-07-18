# Getting started

## 1. Create an account & project

Sign in at the web app (GitHub OAuth). A **project** (workspace) is the unit of
team sharing; memory never leaks across projects. Create one, or join a teammate's
with its join code.

## 2. Connect a repo

Install the CLI once, then connect each repo from your local checkout:

```shell
npm install -g memmo
memmo login          # stores an API token in ~/.memmo
memmo init           # in your repo — writes CLAUDE.md, .mcp.json, hooks
memmo status         # verify the connection
```

`memmo init` wires the repo so Claude Code discovers the Memmo MCP server, which
exposes `search_memory`, `get_repo_context`, `get_relevant_warnings`, and
`record_session_summary`.

You can also connect a repo from the app's **Setup** tab (a drawer with the
`memmo init --repo <id>` command and the PR reviewer toggle).

## 3. Capture & review memory

- **Bootstrap:** run `memmo scan` (or the Setup drawer's "Scan codebase") to
  propose starter memories from the README/manifest/structure.
- As Claude Code works, sessions are recorded and durable memories are **proposed**.
- Review them in **Knowledge → Inbox**: approve to make them retrievable, or reject.
  Approved memories are served back via MCP and can be synced into `CLAUDE.md`
  (`memmo sync`).

## 4. Turn on the PR reviewer (optional)

```shell
memmo ci                     # writes .github/workflows/memmo-review.yml
gh secret set MEMMO_TOKEN    # from `memmo login`
```

Enable the reviewer for the repo (Setup → PR Reviewer). On each PR it posts a
review grounded in the repo's approved memories. Accept/dismiss findings in the
**Reviews** tab to tune the grounding memory's confidence over time.

## 5. Invite your team

In **Settings → Members**, invite teammates by email and assign a role
(owner / admin / member / viewer). See [Core concepts](./concepts.md#roles-rbac).

## Without an Anthropic key

AI features (scan, chat, docs, reviewer) use your project's own Anthropic key
(BYOK, set in Settings). Without one, `memmo scan` drives your local Claude Code
instead — no server key needed.
