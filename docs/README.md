# Cortex documentation

Operational memory for AI coding agents — capture what agents learn, review it,
and inject the right context back into future sessions (and PR reviews).

## Start here

- [Getting started](./getting-started.md) — install the CLI, connect a repo, run the loop.
- [Core concepts](./concepts.md) — memory, the review loop, scoping, roles, plans.

## Guides

- [Reviewer feedback loop](./reviewer-feedback.md) — memory-grounded PR reviews and how
  human feedback tunes memory confidence.
- [Self-hosting](./self-hosting.md) — run the stack (Postgres, Redis, API, web).
- [Enterprise plan](./enterprise-plan.md) — RBAC, orgs, billing, SSO/SCIM, SOC 2 roadmap.

## Reference

- [API reference](./api-reference.md) — every HTTP endpoint (generated; run
  `pnpm docs:api` to refresh).
- [Design system](../DESIGN.md) — the product's visual identity.

## The core loop

```
Claude Code session ──record──▶ AI extracts proposed memories ──human review──▶
approved memory ──inject via MCP / sync to CLAUDE.md──▶ future sessions + PR reviews
        ▲                                                              │
        └────────────── feedback tunes memory confidence ◀────────────┘
```
