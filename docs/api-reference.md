# API reference

> Generated from `apps/api/src/routes/*.ts` by `scripts/gen-api-docs.mjs`.
> Don't edit by hand — re-run the script after changing routes.

75 endpoints. All app endpoints authenticate via a session cookie or a `Bearer` API token; MCP/CLI use the token. Admin endpoints require a superadmin (`SUPERADMIN_EMAILS`).

## admin

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/admin/whoami` | Is the caller a superadmin? (drives whether the app shows the Admin link) |
| `GET` | `/admin/overview` | Platform overview: totals, plan breakdown, rough MRR, recent billing. |
| `GET` | `/admin/workspaces` | Every workspace with owner, plan, and size — the management table. |
| `POST` | `/admin/workspaces/:workspaceId/plan` | Set a workspace's plan (promote-for-free = plan + source "comp"). Logged. |
| `GET` | `/admin/workspaces/:workspaceId` | Full detail for one workspace — members, repos, plan — for admin management. |
| `POST` | `/admin/workspaces/:workspaceId/members` | Add a member to a workspace by email (the user must already have an account). |
| `DELETE` | `/admin/workspaces/:workspaceId/members/:userId` | Remove a member (blocked if they're the last owner — keeps the workspace reachable). |
| `DELETE` | `/admin/workspaces/:workspaceId` | Delete a workspace entirely (cascades to repos, memory, sessions, reviews…). |
| `GET` | `/admin/billing-events` | The billing / payment log (plan grants now, Stripe invoices once wired). |

## auth

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/auth/github/login` | --- GitHub OAuth ------------------------------------------------------- |
| `GET` | `/auth/github/callback` | — |
| `POST` | `/auth/login` | --- Dev email login (non-production only) ------------------------------ |
| `POST` | `/auth/logout` | — |
| `GET` | `/auth/config` | Expose which auth methods are available so the login UI can adapt. |
| `GET` | `/me` | — |
| `GET` | `/auth/tokens` | List the user's API tokens (never returns the raw/hashed token). |
| `POST` | `/auth/tokens` | Mint an API token for CLI/MCP use. Returns the raw token once. |
| `DELETE` | `/auth/tokens/:tokenId` | Revoke an API token. |

## docs

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/repos/:repoId/docs` | — |
| `POST` | `/repos/:repoId/docs/generate` | — |
| `GET` | `/docs/:docId` | — |

## github

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/github/repos` | List the signed-in user's GitHub repositories for the repo picker. |

## graph

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/workspaces/:workspaceId/graph` | — |

## mcp

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/mcp/search_memory` | Return only APPROVED memories for the repo, scoped to the caller's org. |
| `POST` | `/mcp/get_repo_context` | — |
| `POST` | `/mcp/get_relevant_warnings` | Just-in-time warnings for the files the agent is about to edit. |

## memories

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/repos/:repoId/memories` | — |
| `POST` | `/repos/:repoId/memories` | — |
| `POST` | `/repos/:repoId/proposals` | Batch-propose memories from the agent (Claude Code via MCP) — uses the user's own Claude, no server LLM. Lands in the inbox for review. |
| `PATCH` | `/memories/:memoryId` | — |
| `POST` | `/memories/:memoryId/split` | Split a long memory into several atomic, concise memories (archives the original). |
| `POST` | `/memories/:memoryId/${path}` | — |

## metrics

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/stats` | Public aggregate stats for the marketing site (no PII). |
| `GET` | `/workspaces/:workspaceId/metrics` | Per-workspace usage metrics for the product dashboard. |

## repos

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/repos` | List all repos across the user's orgs. |
| `POST` | `/repos` | — |
| `GET` | `/repos/:repoId` | — |
| `PATCH` | `/repos/:repoId` | Update repo context (any member). |
| `DELETE` | `/repos/:repoId` | Disconnect (delete) a repo and its memory/sessions/docs (owners only). |
| `POST` | `/repos/:repoId/scan` | Scan the codebase (README, manifest, structure) and propose starter memories. |
| `POST` | `/repos/:repoId/resync` | Resync repo context (stack, default branch, description) from GitHub. |
| `GET` | `/repos/:repoId/pulls` | List open pull requests for the reviewer UI. |
| `PUT` | `/repos/:repoId/reviewer-skills` | Set which reviewer skills are attached to this repo (replaces the full set). |
| `POST` | `/repos/:repoId/review` | Review a pull request, grounded in this repo's approved memories. Optionally post the review back to the PR as a comment. |
| `POST` | `/repos/:repoId/review-diff` | CI-native review: the caller supplies the diff (computed in CI), we return the review + a ready-to-post Markdown comment. No GitHub access here — the CI job posts the comment. |

## reviews

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/workspaces/:workspaceId/reviews` | All persisted reviews across a workspace's repos (newest first) — powers the project-level Reviews tab so reviews aren't buried per-repo. |
| `GET` | `/repos/:repoId/reviews` | List a repo's persisted reviews (newest first), each with its findings. |
| `GET` | `/reviews/:reviewId` | Fetch a single persisted review (authorized via its repo). |
| `POST` | `/findings/:findingId/feedback` | Give feedback on a single finding; may adjust the grounding memory's confidence. |
| `POST` | `/repos/:repoId/review-feedback` | Bulk feedback keyed by finding dedup key (used by `cortex review-sync`). |

## sessions

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/repos/:repoId/sessions` | Record a Claude Code session, then extract proposed memories from it. |
| `GET` | `/repos/:repoId/sessions` | — |
| `GET` | `/sessions/:sessionId` | — |

## waitlist

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/waitlist/count` | Public count for social proof on the landing page. |

## workspaces

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/workspaces/:workspaceId/memories` | Search memories across every repo in the workspace. |
| `GET` | `/workspaces/:workspaceId/sessions` | All agent sessions across the project's repos (for the project Sessions tab). |
| `GET` | `/workspaces/:workspaceId/docs` | All generated docs across the project's repos (for the project Docs tab). |
| `GET` | `/workspaces` | — |
| `POST` | `/workspaces` | — |
| `POST` | `/workspaces/join` | Join an existing workspace using its join code. |
| `POST` | `/workspaces/:workspaceId/triage` | Re-apply the saved confidence band to all currently-proposed memories (owners only). |
| `POST` | `/workspaces/:workspaceId/members` | Add an existing Cortex user to the workspace by email (owners only). |
| `PATCH` | `/workspaces/:workspaceId/members/:userId/role` | Change a member's role (owners only; can't demote the last owner). |
| `DELETE` | `/workspaces/:workspaceId/members/:userId` | Remove a member from the workspace (admin+; never the last owner). |
| `GET` | `/workspaces/:workspaceId` | — |
| `POST` | `/workspaces/:workspaceId/request-upgrade` | Owner requests an upgrade when self-serve billing is off — logged as a BillingEvent the admin sees (they can then comp/upgrade). No Stripe needed. |
| `POST` | `/workspaces/:workspaceId/billing/checkout` | Start a self-serve upgrade (owners only). Returns a Stripe Checkout URL once billing is configured; until then reports that self-serve billing is off. |
| `PATCH` | `/workspaces/:workspaceId` | Update workspace settings — name and/or auto-approve threshold (owners only). |
| `PUT` | `/workspaces/:workspaceId/anthropic-key` | Set or clear this workspace's Anthropic API key (BYOK, owners only). |
| `DELETE` | `/workspaces/:workspaceId/anthropic-key` | — |
| `POST` | `/workspaces/:workspaceId/rotate-join-code` | Rotate the join code (owners only) — invalidates the old one. |
| `GET` | `/workspaces/:workspaceId/reviewer-skills` | List reusable reviewer skills for a workspace. |
| `POST` | `/workspaces/:workspaceId/reviewer-skills` | Create a reusable reviewer skill (any member). |
| `PATCH` | `/reviewer-skills/:skillId` | Update a reviewer skill. |
| `DELETE` | `/reviewer-skills/:skillId` | Delete a reviewer skill (also detaches it from every repo). |
