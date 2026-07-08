# Getting started

## 1. Create an account & project

Sign in at the web app (GitHub OAuth). A **project** (workspace) is the unit of
team sharing; memory never leaks across projects. Create one, or join a teammate's
with its join code.

## 2. Connect a repo

Install the CLI once, then connect each repo from your local checkout:

```shell
npm install -g @mxbenjaminbeguin/cortex
cortex login          # stores an API token in ~/.cortex
cortex init           # in your repo — writes CLAUDE.md, .mcp.json, hooks
cortex status         # verify the connection
```

`cortex init` wires the repo so Claude Code discovers the Cortex MCP server, which
exposes `search_memory`, `get_repo_context`, `get_relevant_warnings`, and
`record_session_summary`.

You can also connect a repo from the app's **Setup** tab (a drawer with the
`cortex init --repo <id>` command and the PR reviewer toggle).

## 3. Capture & review memory

- **Bootstrap:** run `cortex scan` (or the Setup drawer's "Scan codebase") to
  propose starter memories from the README/manifest/structure.
- As Claude Code works, sessions are recorded and durable memories are **proposed**.
- Review them in **Knowledge → Inbox**: approve to make them retrievable, or reject.
  Approved memories are served back via MCP and can be synced into `CLAUDE.md`
  (`cortex sync`).

## 4. Turn on the PR reviewer (optional)

```shell
cortex ci                     # writes .github/workflows/cortex-review.yml
gh secret set CORTEX_TOKEN    # from `cortex login`
```

Enable the reviewer for the repo (Setup → PR Reviewer). On each PR it posts a
review grounded in the repo's approved memories. Accept/dismiss findings in the
**Reviews** tab to tune the grounding memory's confidence over time.

## 5. Invite your team

In **Settings → Members**, invite teammates by email and assign a role
(owner / admin / member / viewer). See [Core concepts](./concepts.md#roles-rbac).

## Without an Anthropic key

AI features (scan, chat, docs, reviewer) use your project's own Anthropic key
(BYOK, set in Settings). Without one, `cortex scan` drives your local Claude Code
instead — no server key needed.
