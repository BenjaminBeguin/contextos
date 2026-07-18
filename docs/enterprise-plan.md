# Memmo — Enterprise Readiness Plan

Planning document (not yet implemented) for turning Memmo from a working product
into something a company can buy, roll out to a team, and trust with its code
knowledge. Scope: **user & identity management, workspace/org management,
subscriptions & billing, security/compliance, and documentation.**

---

## 0. Where we are today (audit)

What already exists (from `prisma/schema.prisma` + the API):

- **Identity:** `User` (email, GitHub OAuth, avatar). Sign-in via GitHub OAuth +
  dev email login (disabled in prod).
- **Tenancy:** `Workspace` → `Membership` (`role` defaults to `"owner"`, but roles
  are **not enforced** anywhere) → `Repo`. Join via a shared `joinCode`. Member
  invite/remove endpoints exist.
- **Access control:** `assertWorkspaceAccess` / `assertRepoAccess` resolve
  user → membership → workspace; cross-workspace access is rejected (403).
- **Auditing:** `AuditLog` per workspace. `UsageEvent` for product analytics.
- **Secrets:** API tokens hashed; per-workspace `anthropicKey` encrypted (BYOK).
- **Billing:** none.
- **Docs:** README + DEPLOY.md + this `docs/` folder. No product/API docs site.

Gaps for enterprise: no real RBAC, no SSO/SCIM, no org-above-workspace concept,
no seats/plans/billing/entitlements, no self-serve upgrade, thin documentation.

---

## 1. User & identity management

### 1.1 Roles & RBAC (foundational — do first)
Promote the unused `Membership.role` into an enforced enum:

| Role     | Can |
| -------- | --- |
| `owner`  | everything incl. billing, delete workspace, manage members/roles |
| `admin`  | manage repos, reviewer config, members (not billing/delete) |
| `member` | use repos, propose/approve memories, review feedback |
| `viewer` | read-only (memories, reviews, docs); no approvals |

- Add a `requireRole(workspaceId, minRole)` guard beside `assertWorkspaceAccess`;
  apply to every mutating route. Encode a role hierarchy (`owner>admin>member>viewer`).
- Surface role in the members UI (already have invite/remove — add a role dropdown).
- Every approval/rejection/feedback action already can attribute `userId` — start
  writing it to `AuditLog` consistently.

### 1.2 Enterprise sign-in
- **SSO (SAML 2.0 + OIDC)** for Business/Enterprise plans — via WorkOS or Auth0 to
  avoid building SAML ourselves. Map IdP groups → Memmo roles.
- **SCIM 2.0** provisioning/deprovisioning so IT can auto-add/remove seats from
  Okta/Entra. Deprovision = revoke tokens + memberships immediately.
- **Domain capture:** verified email domain auto-joins the right org (replaces the
  shared join code for enterprise; keep join codes for self-serve teams).

### 1.3 Lifecycle
- Invitations by email (pending state, expiry, resend, revoke) — upgrade the current
  direct-add to a real invite flow with an `Invitation` model.
- Session management: list/revoke active sessions & API tokens per user.
- Offboarding: one action to remove a user from all workspaces + kill their tokens.

---

## 2. Workspace / organization management

Introduce an **Organization** above `Workspace` (today workspace is the top tenant):

```
Organization (billing entity, SSO domain, plan)
  └─ Workspace (a team / product area — memories, repos, reviewer config)
       └─ Repo
```

- `Organization` model: name, slug, billing customer id, plan, SSO config, seat count.
- Migrate existing workspaces under an auto-created org per current owner (data
  migration — every workspace gets a parent org; no data loss).
- Org-level settings: default reviewer policy, allowed model providers, data
  retention, SSO enforcement toggle ("require SSO for all members").
- Workspace stays the unit of memory isolation (keep the strict repo/workspace
  scoping that already exists — it's a real security property, don't weaken it).

---

## 3. Subscriptions & billing

### 3.1 Plans (draft — validate before pricing)

| Plan       | Audience            | Key limits / features |
| ---------- | ------------------- | --------------------- |
| **Free**   | solo / trial        | 1 workspace, N repos, X memories, community support, Memmo-hosted model (metered) or BYOK |
| **Team**   | small teams         | seats, unlimited repos, reviewer on all repos, usage analytics, email support |
| **Business** | scaling orgs      | SSO, more seats, audit export, priority support, higher rate limits |
| **Enterprise** | large / regulated | SCIM, SAML enforcement, self-host option, SLA, DPA, dedicated support |

Meter the two real cost drivers: **seats** and **AI usage** (extraction + reviews).
BYOK (already supported) should discount or remove the AI-usage component.

### 3.2 Mechanics
- **Stripe** as the billing system of record. `Organization.stripeCustomerId`,
  `Subscription` model (plan, status, seats, current period, cancelAt).
- **Entitlements service**: a single `can(org, feature)` / `withinLimit(org, metric)`
  used by the API to gate features and by the UI to show/hide. Never scatter plan
  checks — centralize them so a plan change is one config edit.
- **Metering**: aggregate `UsageEvent` (already tracks retrievals, memories,
  `review.feedback`, `repo.pr_reviewed`) into billable counters; report AI usage to
  Stripe as metered usage. This is why the UsageEvent table matters — it's the meter.
- **Seat management**: adding a member consumes a seat; block/prompt-to-upgrade at
  the limit. Proration handled by Stripe.
- **Self-serve**: in-app upgrade/downgrade, Stripe Customer Portal for invoices &
  payment methods. Webhooks (`checkout.session.completed`,
  `customer.subscription.updated/deleted`, `invoice.payment_failed`) → update
  `Subscription` + entitlements; handle dunning/grace on failed payment.
- **Enterprise**: invoice/PO billing (manual entitlement grant), annual contracts.

### 3.3 Guardrails
- Downgrade/cancel must degrade gracefully (data read-only, not deleted; reviewer
  pauses; grace period) — never destroy a customer's memories on lapse.
- Free-tier abuse limits (rate limits already exist on public endpoints — extend).

---

## 4. Security & compliance (enterprise buyers will ask)

- **Data isolation:** keep the workspace-scoped access checks; add automated tests
  that assert cross-tenant reads are impossible (a real test suite as a selling point).
- **Audit log export:** expose `AuditLog` via API + CSV export (Business+).
- **Secrets:** rotate the encryption key story; document key management. Consider
  per-org KMS for Enterprise.
- **Compliance path:** SOC 2 Type II as the first target (most-requested by
  mid-market). Prereqs: audit logging (have it), access reviews, encryption at
  rest/in transit, vendor list, incident response runbook. GDPR: DPA, data export
  & delete (right to erasure), sub-processor list.
- **Retention:** configurable memory/session/review retention per org.
- **Reviewer safety:** the reviewer reads diffs + memories; document that PR content
  is sent to the configured model provider, and honor BYOK / model-region choices.

---

## 5. Documentation (like a real enterprise tool)

Today: README + DEPLOY. Target: a versioned docs site + reference. Structure:

1. **Product docs** (`docs.memmo.dev` — Mintlify/Docusaurus/Nextra):
   - *Getting started*: install CLI, `memmo login/init`, connect Claude Code.
   - *Core concepts*: memory, proposals → approval, scoping/isolation, the reviewer,
     the **feedback loop** (link `docs/reviewer-feedback.md`), living docs.
   - *Guides*: reviewer setup in CI, reviewer skills, auto-approve thresholds, teams
     & roles, SSO/SCIM setup, self-hosting.
   - *Admin*: workspace/org management, seats, billing, audit export.
2. **API reference:** generate from the Fastify routes (add OpenAPI via
   `@fastify/swagger`) → published, always-in-sync reference. Document the MCP tools
   as a first-class surface.
3. **CLI reference:** auto-generated command docs (mirror `memmo --help`).
4. **Self-host guide:** expand DEPLOY.md into a full runbook (env vars, migrations,
   scaling Postgres/Redis, backups, upgrade path).
5. **Trust center:** security overview, sub-processors, status page, changelog.
6. **In-product:** contextual help, empty-state docs links, a `/docs` deep-link from
   the app (the web app already has a docs area to build on).

Docs are versioned with the product; treat "update the docs" as part of the
definition-of-done for any user-facing change (same rule as "keep landing in sync").

---

## 6. Suggested sequencing

1. **RBAC** (enforce roles) — unblocks everything, small, high trust value.
2. **Invitations + session/token management** — real team onboarding.
3. **Organization layer + data migration** — the billing/SSO substrate.
4. **Stripe subscriptions + entitlements service + metering** — turn on revenue.
5. **Docs site + OpenAPI reference** — parallelizable, start early.
6. **SSO/SCIM** — gate the first enterprise deals.
7. **SOC 2 program** — start once the above stabilizes.

Each step is shippable on its own; none requires the next to deliver value.
