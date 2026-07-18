"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { PLANS, PLAN_LABELS, PLAN_TAGLINES, PLAN_LIMITS, ORG_ROLE_LABELS, type Plan, type OrgRole } from "@memmo/shared";
import {
  getOrg,
  getOrgUsage,
  getOrgBillingEvents,
  createProjectInOrg,
  updateOrg,
  inviteOrgMember,
  setOrgMemberRole,
  removeOrgMember,
  orgStartCheckout,
  orgRequestUpgrade,
  timeAgo,
  type OrgDetail,
} from "../../../lib/api";
import { AppShell } from "../../../components/AppShell";
import { Button, Card, EmptyState, Input, Select, Spinner } from "../../../components/ui";

const SECTIONS = ["Projects", "Members", "Usage", "Subscription", "Billing"] as const;
type Section = (typeof SECTIONS)[number];

export default function OrgPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { orgId } = use(params);
  return (
    <AppShell>
      <Org orgId={orgId} />
    </AppShell>
  );
}

function Org({ orgId }: { orgId: string }) {
  const [section, setSection] = useState<Section>("Projects");
  const { data: org, isLoading } = useQuery({ queryKey: ["org", orgId], queryFn: () => getOrg(orgId) });

  if (isLoading)
    return (
      <p className="flex items-center gap-2 text-[var(--muted)]">
        <Spinner /> Loading…
      </p>
    );
  if (!org) return <EmptyState title="Organization not found" />;
  const canManage = org.role === "owner" || org.role === "admin";

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{org.name}</h1>
          <p className="text-sm text-[var(--muted)]">
            Organization · {org.projects.length} project{org.projects.length === 1 ? "" : "s"} ·{" "}
            <span className="capitalize">{PLAN_LABELS[org.plan]}</span> plan
          </p>
        </div>
        <span className="rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          You&apos;re {ORG_ROLE_LABELS[org.role]}
        </span>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <nav className="flex shrink-0 gap-1 overflow-x-auto lg:w-48 lg:flex-col">
          {SECTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setSection(s)}
              className={
                "shrink-0 rounded-lg px-3 py-2 text-left text-sm transition " +
                (s === section
                  ? "bg-[var(--surface-2)] font-medium text-white"
                  : "text-[var(--muted)] hover:bg-white/5 hover:text-white")
              }
            >
              {s}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-6">
          {section === "Projects" ? <Projects org={org} canManage={canManage} /> : null}
          {section === "Members" ? <Members org={org} /> : null}
          {section === "Usage" ? <Usage org={org} /> : null}
          {section === "Subscription" ? <Subscription org={org} canManage={canManage} /> : null}
          {section === "Billing" ? <Billing org={org} /> : null}
        </div>
      </div>
    </div>
  );
}

function Projects({ org, canManage }: { org: OrgDetail; canManage: boolean }) {
  const qc = useQueryClient();
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createProjectInOrg(org.id, name.trim(), name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 32)),
    onSuccess: () => {
      setName("");
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["org", org.id] });
      qc.invalidateQueries({ queryKey: ["me"] });
    },
  });

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Projects</h2>
          <p className="text-xs text-[var(--muted)]">
            All projects share this org&apos;s {PLAN_LABELS[org.plan]} plan and one bill.
          </p>
        </div>
        {canManage ? (
          <Button variant={adding ? "ghost" : "primary"} onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "New project"}
          </Button>
        ) : null}
      </div>

      {adding ? (
        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            autoFocus
            className="min-w-56 flex-1"
          />
          <Button onClick={() => create.mutate()} disabled={!name.trim()} loading={create.isPending}>
            Create project
          </Button>
        </div>
      ) : null}

      <ul className="mt-4 divide-y divide-[var(--border)]">
        {org.projects.map((p) => (
          <li key={p.id}>
            <Link
              href={`/projects/${p.id}`}
              className="group flex items-center justify-between py-3 text-sm"
            >
              <span className="font-medium transition group-hover:text-[var(--accent)]">{p.name}</span>
              <span className="text-xs text-[var(--faint)]">
                {p.repoCount} repo{p.repoCount === 1 ? "" : "s"} · {p.memberCount} member
                {p.memberCount === 1 ? "" : "s"} →
              </span>
            </Link>
          </li>
        ))}
        {org.projects.length === 0 ? (
          <li className="py-3 text-sm text-[var(--muted)]">No projects yet.</li>
        ) : null}
      </ul>
    </Card>
  );
}

function Members({ org }: { org: OrgDetail }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<OrgRole>("member");
  const canManage = org.role === "owner" || org.role === "admin";
  const isOwner = org.role === "owner";
  const invalidate = () => qc.invalidateQueries({ queryKey: ["org", org.id] });

  const invite = useMutation({
    mutationFn: () => inviteOrgMember(org.id, email.trim(), role),
    onSuccess: () => {
      setEmail("");
      invalidate();
    },
  });
  const setR = useMutation({
    mutationFn: ({ userId, r }: { userId: string; r: OrgRole }) => setOrgMemberRole(org.id, userId, r),
    onSuccess: invalidate,
  });
  const remove = useMutation({
    mutationFn: (userId: string) => removeOrgMember(org.id, userId),
    onSuccess: invalidate,
  });

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Organization members</h2>
      <p className="text-xs text-[var(--muted)]">
        Org owners &amp; admins manage billing and every project. Add people to specific projects
        from each project&apos;s settings.
      </p>
      <ul className="mt-4 space-y-2">
        {org.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{m.name ?? m.email}</span>
              <span className="block text-xs text-[var(--faint)]">{m.email}</span>
            </span>
            <span className="flex items-center gap-2">
              {isOwner ? (
                <Select
                  value={m.role}
                  onChange={(e) => setR.mutate({ userId: m.userId, r: e.target.value as OrgRole })}
                  className="text-xs"
                >
                  {(["owner", "admin", "member"] as OrgRole[]).map((r) => (
                    <option key={r} value={r}>
                      {ORG_ROLE_LABELS[r]}
                    </option>
                  ))}
                </Select>
              ) : (
                <span className="text-xs text-[var(--muted)]">{ORG_ROLE_LABELS[m.role]}</span>
              )}
              {canManage ? (
                <Button variant="ghost" size="sm" onClick={() => remove.mutate(m.userId)}>
                  Remove
                </Button>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
          <Input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="teammate@company.com"
            className="min-w-56 flex-1"
          />
          <Select value={role} onChange={(e) => setRole(e.target.value as OrgRole)}>
            {(["member", "admin"] as OrgRole[]).map((r) => (
              <option key={r} value={r}>
                {ORG_ROLE_LABELS[r]}
              </option>
            ))}
          </Select>
          <Button onClick={() => invite.mutate()} disabled={!email.trim()} loading={invite.isPending}>
            Add
          </Button>
          {invite.isError ? (
            <p className="w-full text-sm text-[var(--alert)]">{(invite.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}
    </Card>
  );
}

function Usage({ org }: { org: OrgDetail }) {
  const { data } = useQuery({ queryKey: ["org-usage", org.id], queryFn: () => getOrgUsage(org.id) });
  const usage = data?.usage ?? org.usage;
  const history = data?.history ?? [];
  const max = Math.max(1, ...history.map((h) => h.count));
  const pct = usage.limit === null ? 0 : Math.min(100, Math.round((usage.used / usage.limit) * 100));
  const over = usage.limit !== null && usage.used >= usage.limit;

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Usage</h2>
          <p className="text-xs text-[var(--muted)]">
            Memory retrievals across all projects this month, vs the {PLAN_LABELS[org.plan]} allotment.
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-semibold tabular-nums ${over ? "text-[var(--signal)]" : ""}`}>
            {usage.used.toLocaleString()}
          </div>
          <div className="text-xs text-[var(--faint)]">
            / {usage.limit === null ? "∞" : usage.limit.toLocaleString()}
          </div>
        </div>
      </div>
      {usage.limit !== null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: over ? "var(--signal)" : "var(--accent)" }}
          />
        </div>
      ) : null}
      <div className="mt-5 flex items-end gap-2">
        {[...history].reverse().map((h) => (
          <div key={h.month} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-24 w-full items-end">
              <div
                className="w-full rounded-t bg-[var(--accent)]/70"
                style={{ height: `${Math.max(3, Math.round((h.count / max) * 100))}%` }}
                title={`${h.count.toLocaleString()} retrievals`}
              />
            </div>
            <span className="text-[10px] tabular-nums text-[var(--muted)]">{h.count.toLocaleString()}</span>
            <span className="text-[10px] text-[var(--faint)]">{h.month.slice(5)}</span>
          </div>
        ))}
        {history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No retrievals yet.</p>
        ) : null}
      </div>
    </Card>
  );
}

const PLAN_ACCENT: Record<Plan, string> = {
  free: "var(--muted)",
  scale: "var(--accent)",
  enterprise: "var(--verify)",
};

function Subscription({ org, canManage }: { org: OrgDetail; canManage: boolean }) {
  const [requested, setRequested] = useState<Plan | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const checkout = useMutation<{ url?: string }, Error, Plan>({
    mutationFn: (plan) =>
      org.billingEnabled ? orgStartCheckout(org.id, plan) : orgRequestUpgrade(org.id, plan).then(() => ({})),
    onSuccess: (r, plan) => {
      if (org.billingEnabled && r.url) window.location.href = r.url;
      else setRequested(plan);
    },
    onError: (e) => setMsg(e.message),
  });

  return (
    <Card className="p-6">
      <h2 className="font-semibold">Subscription</h2>
      <p className="text-sm text-[var(--muted)]">
        You&apos;re on the{" "}
        <span style={{ color: PLAN_ACCENT[org.plan] }} className="font-medium">
          {PLAN_LABELS[org.plan]}
        </span>{" "}
        plan{org.planSource === "comp" ? " (comped)" : ""}. It covers every project in the org.
      </p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {PLANS.map((p) => {
          const isCurrent = p === org.plan;
          const l = PLAN_LIMITS[p];
          return (
            <div
              key={p}
              className="rounded-xl border p-4"
              style={{ borderColor: isCurrent ? PLAN_ACCENT[p] : "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium" style={{ color: PLAN_ACCENT[p] }}>
                  {PLAN_LABELS[p]}
                </span>
                {isCurrent ? (
                  <span className="text-[10px] uppercase tracking-wide text-[var(--muted)]">Current</span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-[var(--faint)]">{PLAN_TAGLINES[p]}</p>
              <ul className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                <li>
                  {l.retrievalsPerMonth === null
                    ? "Unlimited retrievals"
                    : `${l.retrievalsPerMonth.toLocaleString()} retrievals/mo`}
                </li>
                <li>{l.reviewer ? "PR reviewer" : "No reviewer"}</li>
                {l.byodb ? <li>Data residency</li> : null}
              </ul>
              {canManage && !isCurrent ? (
                p === "enterprise" ? (
                  <a
                    href="mailto:sales@memmo.dev?subject=Memmo%20Enterprise"
                    className="mt-3 inline-flex w-full items-center justify-center rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs hover:bg-white/5"
                  >
                    Contact us
                  </a>
                ) : (
                  <Button
                    size="sm"
                    className="mt-3 w-full"
                    variant={p === "free" ? "ghost" : "primary"}
                    onClick={() => checkout.mutate(p)}
                    disabled={requested === p}
                    loading={checkout.isPending && checkout.variables === p}
                  >
                    {requested === p ? "Requested ✓" : p === "free" ? "Downgrade" : org.billingEnabled ? "Upgrade" : "Request"}
                  </Button>
                )
              ) : null}
            </div>
          );
        })}
      </div>
      {requested ? (
        <p className="mt-3 text-xs text-[var(--verify)]">
          Upgrade to {PLAN_LABELS[requested]} requested — an admin will follow up.
        </p>
      ) : null}
      {msg ? <p className="mt-3 text-xs text-[var(--signal)]">{msg}</p> : null}
    </Card>
  );
}

function Billing({ org }: { org: OrgDetail }) {
  const { data, isLoading } = useQuery({
    queryKey: ["org-billing", org.id],
    queryFn: () => getOrgBillingEvents(org.id),
    retry: false,
  });
  return (
    <Card className="p-6">
      <h2 className="font-semibold">Billing history</h2>
      <p className="text-xs text-[var(--muted)]">Plan grants, upgrade requests, and invoices.</p>
      {isLoading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No billing activity yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {data.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{e.type.replace(/_/g, " ")}</span>
                {e.plan ? <span className="text-[var(--muted)]"> · {e.plan}</span> : null}
                {e.note ? <div className="truncate text-xs text-[var(--faint)]">{e.note}</div> : null}
              </div>
              <div className="shrink-0 text-xs text-[var(--faint)]" title={new Date(e.createdAt).toLocaleString()}>
                {timeAgo(e.createdAt)}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
