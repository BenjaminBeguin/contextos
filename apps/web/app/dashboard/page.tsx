"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PLAN_LABELS } from "@cortex/shared";
import {
  api,
  getOrg,
  getOrgs,
  type Me,
  type OrgDetail,
  type Workspace,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ProjectForms } from "../../components/ProjectForms";
import { OrgForms } from "../../components/OrgForms";
import { CopyButton } from "../../components/CopyButton";
import { useActiveWorkspace } from "../../lib/workspace";
import { useActiveOrg } from "../../lib/activeOrg";
import { projectColor } from "../../lib/projectColor";
import { Button, Card, PageHeader, Spinner } from "../../components/ui";

export default function DashboardPage() {
  return (
    <AppShell>
      <Home />
    </AppShell>
  );
}

function Home() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: getOrgs });
  const activeOrg = useActiveOrg();

  if (!me || orgs === undefined) return null;
  if (orgs.length === 0) return <OnboardingGate />;
  if (!activeOrg) return null;
  return <OrgHome orgId={activeOrg.id} />;
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? "?") + (p[1]?.[0] ?? "")).toUpperCase();
}

function OrgHome({ orgId }: { orgId: string }) {
  const { data: org } = useQuery({ queryKey: ["org", orgId], queryFn: () => getOrg(orgId) });
  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api<Workspace[]>("/workspaces"),
  });
  const { setActiveId } = useActiveWorkspace();
  const [showForm, setShowForm] = useState(false);

  if (!org) {
    return (
      <p className="flex items-center gap-2 text-[var(--muted)]">
        <Spinner /> Loading…
      </p>
    );
  }

  const pendingByWs = new Map((workspaces ?? []).map((w) => [w.id, w.pendingMemories ?? 0]));
  const projects = org.projects.map((p) => ({ ...p, pending: pendingByWs.get(p.id) ?? 0 }));
  const totalRepos = projects.reduce((n, p) => n + p.repoCount, 0);
  const totalPending = projects.reduce((n, p) => n + p.pending, 0);
  const attention = projects.filter((p) => p.pending > 0).sort((a, b) => b.pending - a.pending);

  return (
    <div>
      <PageHeader
        title={org.name}
        description={`${PLAN_LABELS[org.plan]} plan · ${projects.length} project${
          projects.length === 1 ? "" : "s"
        }`}
        actions={
          <div className="flex items-center gap-2">
            <Link href={`/orgs/${org.id}`}>
              <Button variant="ghost">Manage organization</Button>
            </Link>
            <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New project"}</Button>
          </div>
        }
      />

      {showForm ? (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold">New project in {org.name}</h2>
          <div className="mt-4">
            <ProjectForms
              org={{ id: org.id, name: org.name }}
              onDone={(id) => {
                if (id) setActiveId(id);
                setShowForm(false);
              }}
            />
          </div>
        </Card>
      ) : null}

      {/* Stat tiles */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Repos" value={totalRepos} />
        <Stat label="To review" value={totalPending} accent={totalPending > 0} />
        <Stat
          label="Retrievals this month"
          value={org.usage.used.toLocaleString()}
          sub={org.usage.limit == null ? "unlimited" : `of ${org.usage.limit.toLocaleString()}`}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        {/* Projects */}
        <div className="lg:col-span-2">
          <SectionTitle>Projects</SectionTitle>
          {projects.length === 0 ? (
            <Card className="p-6 text-sm text-[var(--muted)]">
              No projects yet — create one to get started.
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {projects.map((p) => (
                <Link
                  key={p.id}
                  href={`/projects/${p.id}`}
                  className="group"
                  onClick={() => setActiveId(p.id)}
                >
                  <Card hover className="relative h-full overflow-hidden p-4">
                    <div
                      className="-mx-4 -mt-4 mb-3 h-1"
                      style={{ background: `linear-gradient(90deg, ${projectColor(p.id).color}, transparent 85%)` }}
                    />
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-semibold transition group-hover:text-[var(--accent)]">
                        <span
                          className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ background: projectColor(p.id).color, boxShadow: `0 0 10px ${projectColor(p.id).color}` }}
                        />
                        {p.name}
                      </h3>
                      {p.pending > 0 ? (
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                          style={{ background: "var(--signal-soft)", color: "var(--signal)" }}
                        >
                          {p.pending} to review
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      {p.repoCount} repo{p.repoCount === 1 ? "" : "s"} · {p.memberCount} member
                      {p.memberCount === 1 ? "" : "s"}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Side widgets */}
        <div className="space-y-6">
          <UsageWidget usage={org.usage} plan={org.plan} />
          <AttentionWidget items={attention} />
          <TeamWidget org={org} />
        </div>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-4">
      <p className="text-xs text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${accent ? "text-[var(--signal)]" : ""}`}>{value}</p>
      {sub ? <p className="text-xs text-[var(--faint)]">{sub}</p> : null}
    </Card>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
      {children}
    </h2>
  );
}

function UsageWidget({ usage, plan }: { usage: OrgDetail["usage"]; plan: OrgDetail["plan"] }) {
  const pct = usage.limit == null ? 0 : Math.min(100, Math.round((usage.used / usage.limit) * 100));
  return (
    <div>
      <SectionTitle>Usage</SectionTitle>
      <Card className="p-5">
        <p className="text-sm text-[var(--muted)]">Memory retrievals this month</p>
        <p className="mt-1 text-xl font-semibold">
          {usage.used.toLocaleString()}
          {usage.limit != null ? (
            <span className="text-sm font-normal text-[var(--faint)]"> / {usage.limit.toLocaleString()}</span>
          ) : (
            <span className="text-sm font-normal text-[var(--faint)]"> · unlimited</span>
          )}
        </p>
        {usage.limit != null ? (
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-[var(--surface-2)]">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${pct}%`,
                background: pct >= 100 && usage.hardCap ? "var(--signal)" : "var(--accent)",
              }}
            />
          </div>
        ) : null}
        <p className="mt-2 text-xs text-[var(--faint)]">{PLAN_LABELS[plan]} plan</p>
      </Card>
    </div>
  );
}

function AttentionWidget({ items }: { items: { id: string; name: string; pending: number }[] }) {
  return (
    <div>
      <SectionTitle>Needs attention</SectionTitle>
      <Card className="p-5">
        {items.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">All caught up — no memories awaiting review. ✨</p>
        ) : (
          <ul className="space-y-2">
            {items.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="flex items-center justify-between text-sm text-[var(--muted)] transition hover:text-white"
                >
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block h-2 w-2 rounded-full"
                      style={{ background: projectColor(p.id).color }}
                    />
                    {p.name}
                  </span>
                  <span className="font-medium text-[var(--signal)]">{p.pending} to review</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

function TeamWidget({ org }: { org: OrgDetail }) {
  const shown = org.members.slice(0, 6);
  return (
    <div>
      <SectionTitle>Team</SectionTitle>
      <Card className="p-5">
        <div className="flex items-center gap-2">
          <div className="flex -space-x-2">
            {shown.map((m) =>
              m.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={m.userId}
                  src={m.avatarUrl}
                  alt=""
                  className="h-8 w-8 rounded-full ring-2 ring-[var(--background)]"
                />
              ) : (
                <span
                  key={m.userId}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surface-2)] text-[10px] font-semibold ring-2 ring-[var(--background)]"
                >
                  {initials(m.name ?? m.email)}
                </span>
              ),
            )}
          </div>
          <span className="text-sm text-[var(--muted)]">
            {org.members.length} member{org.members.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className="mt-4 flex items-center justify-between gap-2 border-t border-[var(--border)] pt-3">
          <div className="min-w-0">
            <p className="text-xs text-[var(--faint)]">Invite with join code</p>
            <code className="text-xs text-[var(--fg)]">{org.joinCode}</code>
          </div>
          <CopyButton value={org.joinCode} />
        </div>
        <Link
          href={`/orgs/${org.id}`}
          className="mt-3 inline-block text-xs text-[var(--accent)] hover:underline"
        >
          Manage members →
        </Link>
      </Card>
    </div>
  );
}

function OnboardingGate() {
  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">Get started</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Create your first project — it starts a new organization you own — or join an existing one.
        </p>
        <div className="mt-6">
          <ProjectForms />
        </div>
      </div>
      <div>
        <SectionTitle>Or join an organization</SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-[var(--muted)]">
          Have a code from your team? Join their organization.
        </p>
        <OrgForms />
      </div>
    </div>
  );
}
