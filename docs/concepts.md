# Core concepts

## Memory

A **memory** is a durable, atomic fact about a repo — a rule, convention,
architecture note, command, risk, or past failure. Each has a `type`, `title`,
`content`, optional `paths` (globs for just-in-time warnings), a `confidence`
score, and a `status`.

Memories flow **proposed → approved → (archived/rejected)**. Proposed memories
come from recorded agent sessions or `memmo scan`; a human approves them in the
inbox. Only **approved** memories are served to agents.

- **Auto-triage** (Settings): confidence thresholds can auto-approve/auto-reject
  proposals so the inbox only holds the ambiguous ones.
- **Usage** (`used N×`): counts real agent (MCP) retrievals, so you can see which
  memories actually pull their weight.

## The review loop

The memory-grounded **PR reviewer** reads a diff plus the repo's approved memories
and posts findings tied to the memory that grounded each one. When a human
**accepts** or **dismisses** a finding, the grounding memory's confidence moves
(accept +, dismiss −). See [Reviewer feedback loop](./reviewer-feedback.md).

## Scoping & isolation

Everything is scoped to a **repo** inside a **project (workspace)**. Cross-project
access is rejected. Memory never leaks between projects.

## Roles (RBAC)

Each member has a workspace role; privileges are inclusive top→down:

| Role | Can |
| --- | --- |
| **owner** | everything — billing, delete workspace, manage roles |
| **admin** | manage repos, reviewer config, invite/remove members |
| **member** | use repos, approve/reject memories, give review feedback |
| **viewer** | read-only |

Enforced server-side (`requireRole` / `requireRepoRole`) and surfaced in
**Settings → Members**.

## Plans & billing

Plans (free / team / business / enterprise) set limits (repos, seats) and features
(reviewer, SSO) — a single entitlements source enforced in the API and shown in the
**Billing** tab. Without Stripe configured, "Upgrade" files a request an admin sees
in the [admin dashboard](./enterprise-plan.md) and can comp. See
[Enterprise plan](./enterprise-plan.md).

## MCP surface

The Memmo MCP server (via `memmo init`) exposes to Claude Code:

- `search_memory(query)` — approved memories for the repo (counts as usage).
- `get_repo_context()` — stack, commands, risk warnings.
- `get_relevant_warnings(files)` — just-in-time warnings for files about to change.
- `record_session_summary(...)` — submit what the agent did; Memmo extracts
  proposed memories for review.
