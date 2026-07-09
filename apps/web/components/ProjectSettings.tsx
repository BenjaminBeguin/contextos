"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PLAN_LIMITS, PLAN_LABELS, type Plan } from "@cortex/shared";
import {
  api,
  connectDataStore,
  testDataStore,
  disconnectDataStore,
  getReusableDataStores,
  reuseDataStore,
  getOrgs,
  moveProjectToOrg,
  type Me,
  type WorkspaceDetail,
} from "../lib/api";
import { CopyButton } from "./CopyButton";
import { Button, Card, Input, Select } from "./ui";
import { AuditLogCard } from "./AuditLogCard";


// Left-rail sections. Ordered as a natural top-to-bottom flow: identity first,
// then people, then what they're consuming, then the plan that governs it, then
// the money trail. Billing history is owner-only, so it's filtered out below.
export const SETTINGS_SECTIONS = [
  "General",
  "Members",
  "Usage",
  "Data",
  "Subscription",
] as const;
export type SettingsSection = (typeof SETTINGS_SECTIONS)[number];

const SECTION_HINT: Record<SettingsSection, string> = {
  General: "Name, join code, AI key, triage",
  Members: "People & roles",
  Usage: "What this project is consuming",
  Data: "Data residency — bring your own DB",
  Subscription: "Plan & billing (organization)",
};

/** Project (workspace) settings with a left side-menu:
    General · Members · Usage · Subscription · Billing. */
export function ProjectSettings({
  workspaceId,
  isOwner,
  section,
  onSection,
}: {
  workspaceId: string;
  isOwner: boolean;
  section: SettingsSection;
  onSection: (s: SettingsSection) => void;
}) {
  const { data: ws } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api<WorkspaceDetail>(`/workspaces/${workspaceId}`),
  });

  const sections = SETTINGS_SECTIONS;
  const active = sections.includes(section) ? section : "General";

  if (!ws) return <Card className="p-6 text-[var(--muted)]">Loading…</Card>;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-56 lg:flex-col lg:overflow-visible">
        {sections.map((s) => {
          const on = s === active;
          return (
            <button
              key={s}
              onClick={() => onSection(s)}
              className={
                "group flex shrink-0 flex-col rounded-lg px-3 py-2 text-left transition " +
                (on
                  ? "bg-[var(--surface-2)] text-white"
                  : "text-[var(--muted)] hover:bg-white/5 hover:text-white")
              }
            >
              <span className="flex items-center gap-2 text-sm font-medium">
                {on ? (
                  <span className="h-3.5 w-0.5 rounded-full bg-[var(--accent)]" aria-hidden />
                ) : (
                  <span className="h-3.5 w-0.5 rounded-full bg-transparent" aria-hidden />
                )}
                {s}
              </span>
              <span className="ml-2.5 hidden text-xs text-[var(--faint)] lg:block">
                {SECTION_HINT[s]}
              </span>
            </button>
          );
        })}
      </nav>

      <div className="min-w-0 flex-1 space-y-6">
        {active === "General" ? (
          <>
            <GeneralCard workspaceId={workspaceId} ws={ws} isOwner={isOwner} />
            <AiKeyCard workspaceId={workspaceId} hasKey={!!ws.hasAnthropicKey} isOwner={isOwner} />
            <AutoTriageCard
              workspaceId={workspaceId}
              approve={ws.autoApproveThreshold ?? null}
              reject={ws.autoRejectThreshold ?? null}
              isOwner={isOwner}
            />
            {isOwner ? <MoveOrgCard workspaceId={workspaceId} ws={ws} /> : null}
          </>
        ) : null}

        {active === "Members" ? (
          <>
            <MembersCard
              workspaceId={workspaceId}
              memberships={ws.memberships}
              isOwner={isOwner}
              org={ws.organization}
            />
            {isOwner ? <AuditLogCard workspaceId={workspaceId} /> : null}
          </>
        ) : null}

        {active === "Usage" ? <UsageCard ws={ws} /> : null}

        {active === "Data" ? (
          <DataResidencyCard workspaceId={workspaceId} ws={ws} isOwner={isOwner} />
        ) : null}

        {active === "Subscription" ? <OrgBillingDefer ws={ws} /> : null}
      </div>
    </div>
  );
}

function GeneralCard({
  workspaceId,
  ws,
  isOwner,
}: {
  workspaceId: string;
  ws: WorkspaceDetail;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [name, setName] = useState("");

  const rename = useMutation({
    mutationFn: () =>
      api(`/workspaces/${workspaceId}`, { method: "PATCH", body: JSON.stringify({ name }) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });
  const rotate = useMutation({
    mutationFn: () => api(`/workspaces/${workspaceId}/rotate-join-code`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Project</h2>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Input
          defaultValue={ws.name}
          onChange={(e) => setName(e.target.value)}
          disabled={!isOwner}
          className="w-56 disabled:opacity-60"
        />
        {isOwner ? (
          <Button onClick={() => rename.mutate()} disabled={!name || rename.isPending}>
            {rename.isPending ? "Saving…" : "Rename"}
          </Button>
        ) : (
          <span className="text-xs text-[var(--muted)]">Only owners can edit</span>
        )}
      </div>

      <div className="mt-5 flex items-center justify-between border-t border-[var(--border)] pt-4">
        <div>
          <p className="text-sm">Join code</p>
          <p className="text-xs text-[var(--muted)]">Share to invite teammates.</p>
        </div>
        <div className="flex items-center gap-2">
          <code className="rounded-md border border-[var(--border)] bg-black/40 px-3 py-1 text-sm">
            {ws.joinCode}
          </code>
          <CopyButton value={ws.joinCode} />
          {isOwner ? (
            <Button variant="ghost" onClick={() => rotate.mutate()} disabled={rotate.isPending}>
              {rotate.isPending ? "…" : "Rotate"}
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function MoveOrgCard({ workspaceId, ws }: { workspaceId: string; ws: WorkspaceDetail }) {
  const qc = useQueryClient();
  const [target, setTarget] = useState("");
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: getOrgs });
  const currentOrgId = ws.organization?.id;
  // Orgs the user can move INTO: managed (owner/admin) and not the current one.
  const targets = (orgs ?? []).filter(
    (o) => o.id !== currentOrgId && (o.role === "owner" || o.role === "admin"),
  );

  const move = useMutation({
    mutationFn: () => moveProjectToOrg(workspaceId, target),
    onSuccess: () => {
      setTarget("");
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["orgs"] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  if (targets.length === 0) return null;

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Organization</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        This project belongs to{" "}
        <span className="text-[var(--text)]">{ws.organization?.name ?? "its organization"}</span>. Move
        it to another organization you manage — its plan and billing follow the new org.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="min-w-56 flex-1"
        >
          <option value="">Move to…</option>
          {targets.map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </Select>
        <Button variant="subtle" onClick={() => move.mutate()} disabled={!target} loading={move.isPending}>
          Move project
        </Button>
      </div>
      {move.isSuccess ? <p className="mt-2 text-xs text-[var(--verify)]">Moved.</p> : null}
      {move.isError ? (
        <p className="mt-2 text-sm text-[var(--alert)]">{(move.error as Error).message}</p>
      ) : null}
    </Card>
  );
}

function UsageCard({ ws }: { ws: WorkspaceDetail }) {
  const current = (ws.plan ?? "free") as Plan;
  const limits = ws.limits ?? PLAN_LIMITS[current];
  const usage = ws.usage ?? { repos: ws.repos.length, seats: ws.memberships.length };
  const retrievals = ws.retrievals ?? { used: 0, limit: limits.retrievalsPerMonth, hardCap: limits.hardCap };
  const totalMemories = ws.repos.reduce((n, r) => n + (r._count?.memories ?? 0), 0);

  const meters: { label: string; used: number; max: number | null }[] = [
    { label: "Retrievals this month", used: retrievals.used, max: retrievals.limit },
    { label: "Repos", used: usage.repos, max: limits.maxRepos },
  ];

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Usage</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            What this project is consuming against your{" "}
            <span className="font-medium">{PLAN_LABELS[current]}</span> plan.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {meters.map((m) => {
          const pct = m.max === null ? 0 : Math.min(100, Math.round((m.used / m.max) * 100));
          const near = m.max !== null && m.used >= m.max;
          return (
            <div key={m.label} className="rounded-lg border border-[var(--border)] p-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[var(--muted)]">{m.label}</span>
                <span className={near ? "text-[var(--signal)]" : ""}>
                  {m.used.toLocaleString()} / {m.max === null ? "∞" : m.max.toLocaleString()}
                </span>
              </div>
              {m.max !== null ? (
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${pct}%`, background: near ? "var(--signal)" : "var(--accent)" }}
                  />
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-sm text-[var(--muted)]">Stored memories</p>
          <p className="mt-1 text-2xl font-semibold tabular-nums">{totalMemories}</p>
        </div>
        <div className="rounded-lg border border-[var(--border)] p-3">
          <p className="text-sm text-[var(--muted)]">PR reviewer</p>
          <p className="mt-1 text-2xl font-semibold" style={{ color: limits.reviewer ? "var(--verify)" : "var(--faint)" }}>
            {limits.reviewer ? "Enabled" : "Not on plan"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-xs text-[var(--faint)]">
        Seats are unlimited on every plan — invite your whole team. Pricing is metered on memory
        retrievals (how often your agents pull memory).
      </p>

      {ws.repos.length > 0 ? (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-sm font-medium">By repo</p>
          <ul className="mt-2 divide-y divide-[var(--border)]">
            {ws.repos.map((r) => (
              <li key={r.id} className="flex items-center justify-between py-2 text-sm">
                <span className="truncate text-[var(--muted)]">{r.fullName}</span>
                <span className="shrink-0 tabular-nums">{r._count?.memories ?? 0} memories</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Card>
  );
}

function DataResidencyCard({
  workspaceId,
  ws,
  isOwner,
}: {
  workspaceId: string;
  ws: WorkspaceDetail;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [url, setUrl] = useState("");
  const [source, setSource] = useState("");
  const entitled = ws.limits?.byodb ?? false;
  const ds = ws.dataStore;
  const connected = ds?.status === "connected";
  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });

  // Sibling projects in the same org that already have a database — reuse one
  // instead of re-entering a URL.
  const { data: reusable } = useQuery({
    queryKey: ["data-store-available", workspaceId],
    queryFn: () => getReusableDataStores(workspaceId),
    enabled: entitled && !connected && isOwner,
  });

  const connect = useMutation({
    mutationFn: () => connectDataStore(workspaceId, url),
    onSuccess: () => {
      setUrl("");
      invalidate();
    },
  });
  const reuse = useMutation({
    mutationFn: () => reuseDataStore(workspaceId, source),
    onSuccess: () => {
      setSource("");
      invalidate();
    },
  });
  const test = useMutation({
    mutationFn: () => testDataStore(workspaceId),
    onSuccess: invalidate,
  });
  const disconnect = useMutation({
    mutationFn: () => disconnectDataStore(workspaceId),
    onSuccess: invalidate,
  });

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 font-semibold">
            Data residency
            <span className="rounded-full border border-[var(--verify)]/40 px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--verify)]">
              Enterprise
            </span>
          </h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Bring your own database. Connect your own Postgres and this project&apos;s memory is
            stored in <span className="text-[var(--text)]">your</span> infrastructure — Cortex keeps
            only routing metadata. Your knowledge never leaves your database.
          </p>
        </div>
        <span
          className="shrink-0 rounded-full px-2.5 py-0.5 text-xs"
          style={
            connected
              ? { background: "var(--verify-soft, rgba(52,211,153,.12))", color: "var(--verify)" }
              : ds?.status === "error"
                ? { background: "var(--alert-soft, rgba(251,113,133,.12))", color: "var(--alert)" }
                : { border: "1px solid var(--border)", color: "var(--muted)" }
          }
        >
          {connected ? "Connected" : ds?.status === "error" ? "Error" : "Not connected"}
        </span>
      </div>

      {!entitled ? (
        <div className="mt-4 rounded-lg border border-[var(--signal)]/30 bg-[var(--signal-soft)] p-4 text-sm">
          <p className="font-medium">Available on Enterprise.</p>
          <p className="mt-1 text-[var(--muted)]">
            Store your team&apos;s memory in your own Postgres for data residency and sovereignty —
            SOC 2 friendly, your keys, your infrastructure.{" "}
            <a href="mailto:sales@cortex.dev?subject=Cortex%20Enterprise%20—%20data%20residency" className="text-[var(--accent)] hover:underline">
              Talk to us →
            </a>
          </p>
        </div>
      ) : (
        <div className="mt-4 space-y-4">
          {connected ? (
            <div className="rounded-lg border border-[var(--border)] p-4">
              <p className="text-sm">
                <span className="text-[var(--verify)]">✓</span> This project&apos;s memory is stored in
                your database.
              </p>
              {ds?.checkedAt ? (
                <p className="mt-1 text-xs text-[var(--faint)]">
                  Last checked {new Date(ds.checkedAt).toLocaleString()}
                </p>
              ) : null}
              {isOwner ? (
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button variant="ghost" size="sm" onClick={() => test.mutate()} loading={test.isPending}>
                    Test connection
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => disconnect.mutate()}
                    loading={disconnect.isPending}
                  >
                    Disconnect
                  </Button>
                  {test.data ? (
                    <span className={`self-center text-xs ${test.data.ok ? "text-[var(--verify)]" : "text-[var(--alert)]"}`}>
                      {test.data.ok ? "Reachable ✓" : test.data.error}
                    </span>
                  ) : null}
                </div>
              ) : null}
              <p className="mt-3 text-xs text-[var(--faint)]">
                Disconnecting stops routing here — your data stays in your database untouched.
              </p>
            </div>
          ) : isOwner ? (
            <div>
              {reusable && reusable.length > 0 ? (
                <div className="mb-5">
                  <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                    Reuse a database from this organization
                  </label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Select
                      value={source}
                      onChange={(e) => setSource(e.target.value)}
                      className="min-w-56 flex-1"
                    >
                      <option value="">Select a project…</option>
                      {reusable.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </Select>
                    <Button
                      variant="subtle"
                      onClick={() => reuse.mutate()}
                      disabled={!source}
                      loading={reuse.isPending}
                    >
                      Use this database
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-[var(--faint)]">
                    Points this project at the same Postgres — each project&apos;s memory stays
                    isolated.
                  </p>
                  {reuse.isError ? (
                    <p className="mt-2 text-sm text-[var(--alert)]">
                      {friendlyDbError((reuse.error as Error).message)}
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center gap-3 text-[10px] uppercase tracking-wide text-[var(--faint)]">
                    <span className="h-px flex-1 bg-[var(--border)]" />
                    or connect a new one
                    <span className="h-px flex-1 bg-[var(--border)]" />
                  </div>
                </div>
              ) : null}
              <label className="mb-1.5 block text-xs font-medium text-[var(--muted)]">
                Postgres connection string
              </label>
              <Input
                type="password"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="postgresql://user:pass@host:5432/dbname"
                className="w-full font-mono text-xs"
              />
              <p className="mt-1.5 text-xs text-[var(--faint)]">
                We connect, create a <code>CortexMemory</code> table, and route this project&apos;s
                memory there. Stored encrypted; never shown again.
              </p>
              <div className="mt-3">
                <Button
                  onClick={() => connect.mutate()}
                  disabled={!url.trim()}
                  loading={connect.isPending}
                >
                  Connect database
                </Button>
              </div>
              {connect.isError ? (
                <p className="mt-2 text-sm text-[var(--alert)]">
                  {friendlyDbError((connect.error as Error).message)}
                </p>
              ) : null}
              {ds?.status === "error" && ds.error ? (
                <p className="mt-2 text-xs text-[var(--alert)]">Last error: {ds.error}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">Only owners can configure the database.</p>
          )}
        </div>
      )}
    </Card>
  );
}

function friendlyDbError(msg: string): string {
  if (msg === "connection_failed") return "Couldn't reach that database — check the host, port, and credentials.";
  if (msg === "provision_failed") return "Connected, but couldn't create the CortexMemory table — check permissions.";
  if (msg === "plan_limit_byodb") return "Data residency is an Enterprise feature.";
  return msg;
}

/** Plan, usage, and billing are managed at the organization level — point
    there instead of duplicating the controls per project. */
function OrgBillingDefer({ ws }: { ws: WorkspaceDetail }) {
  const org = ws.organization;
  const plan = (ws.plan ?? "free") as Plan;
  const retr = ws.retrievals;
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Plan &amp; billing</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        This project runs on the{" "}
        <span className="font-medium text-[var(--text)]">{PLAN_LABELS[plan]}</span> plan
        {org ? (
          <>
            {" "}
            — managed for the organization <span className="text-[var(--text)]">{org.name}</span>
          </>
        ) : null}
        . Change the plan, see usage across all projects, and view billing history there.
      </p>

      {retr ? (
        <div className="mt-4 rounded-lg border border-[var(--border)] p-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">Org retrievals this month</span>
            <span className="tabular-nums">
              {retr.used.toLocaleString()} /{" "}
              {retr.limit === null ? "∞" : retr.limit.toLocaleString()}
            </span>
          </div>
        </div>
      ) : null}

      {org ? (
        <a
          href={`/orgs/${org.id}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg brand-gradient px-4 py-2 text-sm font-semibold text-white transition hover:brightness-110"
        >
          Manage plan &amp; billing in {org.name} →
        </a>
      ) : null}
    </Card>
  );
}

interface OrgMemberOption {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  onProject: boolean;
}

function MembersCard({
  workspaceId,
  memberships,
  isOwner,
  org,
}: {
  workspaceId: string;
  memberships: WorkspaceDetail["memberships"];
  isOwner: boolean;
  org?: { id: string; name: string } | null;
}) {
  const qc = useQueryClient();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
    qc.invalidateQueries({ queryKey: ["org-members-for-project", workspaceId] });
  };

  // The org's people — the pool we assign from. Managed at the org level.
  const { data: orgMembers } = useQuery({
    queryKey: ["org-members-for-project", workspaceId],
    queryFn: () => api<OrgMemberOption[]>(`/workspaces/${workspaceId}/org-members`),
    enabled: isOwner,
  });

  const assign = useMutation({
    mutationFn: (userId: string) =>
      api(`/workspaces/${workspaceId}/members`, {
        method: "POST",
        body: JSON.stringify({ userId }),
      }),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (userId: string) =>
      api(`/workspaces/${workspaceId}/members/${userId}`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  const assignable = (orgMembers ?? []).filter((m) => !m.onProject);

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Members</h2>
      <p className="mt-1 text-xs text-[var(--muted)]">
        People are managed in{" "}
        {org ? (
          <Link href={`/orgs/${org.id}`} className="text-[var(--fg)] hover:text-[var(--accent)]">
            {org.name}
          </Link>
        ) : (
          "your organization"
        )}
        . Assign them to this project below.
      </p>
      <ul className="mt-4 space-y-2">
        {memberships.map((m) => (
          <li key={m.user.id} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2">
              {m.user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={m.user.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
              ) : (
                <span className="h-6 w-6 rounded-full bg-white/10" />
              )}
              {m.user.name ?? m.user.email}
              {m.user.id === me?.id ? (
                <span className="text-xs text-[var(--faint)]">(you)</span>
              ) : null}
            </span>
            <span className="flex items-center gap-3">
              {m.role === "owner" ? (
                <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  Owner
                </span>
              ) : null}
              {isOwner && m.role !== "owner" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove.mutate(m.user.id)}
                  disabled={remove.isPending}
                >
                  Remove
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>

      {isOwner ? (
        <div className="mt-5 border-t border-[var(--border)] pt-4">
          <p className="text-sm">Assign from {org?.name ?? "the organization"}</p>
          {assignable.length === 0 ? (
            <p className="mt-2 text-xs text-[var(--muted)]">
              Everyone in the organization is already on this project.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {assignable.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    {o.avatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={o.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                    ) : (
                      <span className="h-6 w-6 rounded-full bg-white/10" />
                    )}
                    {o.name ?? o.email}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => assign.mutate(o.id)}
                    disabled={assign.isPending}
                  >
                    Add
                  </Button>
                </li>
              ))}
            </ul>
          )}
          {assign.isError ? (
            <p className="mt-2 text-sm text-red-400">{(assign.error as Error).message}</p>
          ) : null}
          {remove.isError ? (
            <p className="mt-2 text-sm text-red-400">{(remove.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function AiKeyCard({
  workspaceId,
  hasKey,
  isOwner,
}: {
  workspaceId: string;
  hasKey: boolean;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [key, setKey] = useState("");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });

  const save = useMutation({
    mutationFn: () =>
      api(`/workspaces/${workspaceId}/anthropic-key`, {
        method: "PUT",
        body: JSON.stringify({ key }),
      }),
    onSuccess: () => {
      setKey("");
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: () => api(`/workspaces/${workspaceId}/anthropic-key`, { method: "DELETE" }),
    onSuccess: invalidate,
  });

  return (
    <Card className="p-6">
      <h2 className="font-semibold">AI provider (Anthropic key)</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Add your own Anthropic API key to power AI features — codebase scan, session extraction,
        living docs, and chat — on your own billing. Without a key, those run a deterministic
        fallback (no AI cost).
      </p>
      <p className="mt-3 text-sm">
        {hasKey ? (
          <span className="text-emerald-300">✓ Key configured for this project</span>
        ) : (
          <span className="text-[var(--muted)]">No key set</span>
        )}
      </p>

      {isOwner ? (
        <div className="mt-4 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <Input
              type="password"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="sk-ant-…"
              className="min-w-64 flex-1"
            />
            <Button onClick={() => save.mutate()} disabled={!key || save.isPending}>
              {save.isPending ? "Saving…" : hasKey ? "Replace" : "Save key"}
            </Button>
            {hasKey ? (
              <Button variant="danger" onClick={() => remove.mutate()} disabled={remove.isPending}>
                Remove
              </Button>
            ) : null}
          </div>
          {save.isError ? <p className="text-sm text-red-400">{(save.error as Error).message}</p> : null}
          <p className="text-xs text-[var(--muted)]">
            Stored encrypted; never shown again. Get a key at console.anthropic.com.
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">Only owners can manage the API key.</p>
      )}
    </Card>
  );
}

function AutoTriageCard({
  workspaceId,
  approve,
  reject,
  isOwner,
}: {
  workspaceId: string;
  approve: number | null;
  reject: number | null;
  isOwner: boolean;
}) {
  const qc = useQueryClient();
  const [approveOn, setApproveOn] = useState(approve != null);
  const [approvePct, setApprovePct] = useState(Math.round((approve ?? 0.85) * 100));
  const [rejectOn, setRejectOn] = useState(reject != null);
  const [rejectPct, setRejectPct] = useState(Math.round((reject ?? 0.4) * 100));

  const save = useMutation({
    mutationFn: () =>
      api(`/workspaces/${workspaceId}`, {
        method: "PATCH",
        body: JSON.stringify({
          autoApproveThreshold: approveOn ? approvePct / 100 : null,
          autoRejectThreshold: rejectOn ? rejectPct / 100 : null,
        }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["workspace", workspaceId] }),
  });

  // Apply the SAVED band to existing proposed memories (auto-triage only runs at creation).
  const reTriage = useMutation({
    mutationFn: () =>
      api<{ approved: number; rejected: number; kept: number }>(
        `/workspaces/${workspaceId}/triage`,
        { method: "POST" },
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workspace", workspaceId] });
      qc.invalidateQueries({ queryKey: ["workspaces"] });
      qc.invalidateQueries({ queryKey: ["memories"] });
      qc.invalidateQueries({ queryKey: ["workspace-memories"] });
    },
  });
  const hasSaved = approve != null || reject != null;

  const conflict = approveOn && rejectOn && rejectPct >= approvePct;

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Automatic triage</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Route new proposed memories by confidence so the inbox only holds the ones that need a human
        call.
      </p>

      <p className="mt-3 text-sm text-[var(--muted)]">
        {approveOn ? (
          <span className="text-emerald-300">≥ {approvePct}% → auto-approve</span>
        ) : (
          <span>approve: off</span>
        )}
        {"  ·  "}
        {rejectOn ? (
          <span className="text-red-300">&lt; {rejectPct}% → auto-reject</span>
        ) : (
          <span>reject: off</span>
        )}
        {"  ·  "}
        <span>everything else → inbox</span>
      </p>

      {isOwner ? (
        <div className="mt-5 space-y-4">
          <TriageRow
            label="Auto-approve at or above"
            on={approveOn}
            setOn={setApproveOn}
            pct={approvePct}
            setPct={setApprovePct}
            accent="accent-emerald-400"
          />
          <TriageRow
            label="Auto-reject below"
            on={rejectOn}
            setOn={setRejectOn}
            pct={rejectPct}
            setPct={setRejectPct}
            accent="accent-red-400"
          />
          {conflict ? (
            <p className="text-xs text-yellow-300">
              The reject threshold should be lower than the approve threshold.
            </p>
          ) : null}
          <Button onClick={() => save.mutate()} loading={save.isPending} disabled={conflict}>
            Save triage rules
          </Button>
          {save.isSuccess ? <span className="ml-2 text-xs text-emerald-300">Saved</span> : null}

          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <p className="text-sm">Apply to existing proposals</p>
            <p className="text-xs text-[var(--muted)]">
              Auto-triage only runs on new memories. Run it across everything already in the inbox
              using your <em>saved</em> thresholds.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Button
                variant="subtle"
                onClick={() => reTriage.mutate()}
                loading={reTriage.isPending}
                disabled={!hasSaved}
              >
                Re-triage inbox
              </Button>
              {!hasSaved ? (
                <span className="text-xs text-[var(--faint)]">Save a threshold first.</span>
              ) : null}
              {reTriage.isSuccess ? (
                <span className="text-xs text-emerald-300">
                  Approved {reTriage.data.approved} · rejected {reTriage.data.rejected} ·{" "}
                  {reTriage.data.kept} left for review
                </span>
              ) : null}
              {reTriage.isError ? (
                <span className="text-xs text-red-400">{(reTriage.error as Error).message}</span>
              ) : null}
            </div>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-xs text-[var(--muted)]">Only owners can change this.</p>
      )}
    </Card>
  );
}

function TriageRow({
  label,
  on,
  setOn,
  pct,
  setPct,
  accent,
}: {
  label: string;
  on: boolean;
  setOn: (v: boolean) => void;
  pct: number;
  setPct: (v: number) => void;
  accent: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="flex w-52 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => setOn(e.target.checked)}
          className="accent-[var(--accent)]"
        />
        {label}
      </label>
      <input
        type="range"
        min={5}
        max={100}
        step={5}
        value={pct}
        onChange={(e) => setPct(Number(e.target.value))}
        disabled={!on}
        className={`h-1.5 w-56 max-w-full cursor-pointer ${accent} disabled:opacity-40`}
      />
      <span className={`w-12 text-sm tabular-nums ${on ? "" : "text-[var(--faint)]"}`}>{pct}%</span>
    </div>
  );
}
