"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminWhoami,
  getAdminOverview,
  getAdminWorkspaces,
  getAdminPricing,
  setPlanPrice,
  getBillingEvents,
  setWorkspacePlan,
  type AdminWorkspace,
  type AdminPlanPricing,
  type Plan,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import {
  Button,
  Card,
  EmptyState,
  Input,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";

const PLANS: Plan[] = ["free", "scale", "enterprise"];

const PLAN_STYLE: Record<string, string> = {
  free: "bg-white/8 text-[var(--muted)] border-white/10",
  scale: "bg-[var(--accent-soft)] text-[var(--accent-hover)] border-[var(--accent)]/30",
  enterprise: "border-[var(--verify)]/30 text-[var(--verify)]",
};

function compactNum(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);
}

export default function AdminPage() {
  return (
    <AppShell>
      <Admin />
    </AppShell>
  );
}

function Admin() {
  const { data: who, isLoading } = useQuery({
    queryKey: ["admin-whoami"],
    queryFn: getAdminWhoami,
    retry: false,
  });

  if (isLoading)
    return (
      <p className="flex items-center gap-2 text-[var(--muted)]">
        <Spinner /> Loading…
      </p>
    );
  if (!who?.isSuperAdmin)
    return (
      <EmptyState
        title="Not authorized"
        description="This is the platform admin area. Your account isn't a superadmin (set SUPERADMIN_EMAILS on the API)."
      />
    );

  return (
    <div>
      <PageHeader title="Admin" description="Platform management — plans, subscriptions, and billing." />
      <Overview />
      <PricingSection />
      <Workspaces />
      <BillingLog />
    </div>
  );
}

function PricingSection() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["admin-pricing"], queryFn: getAdminPricing });
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const save = useMutation({
    mutationFn: ({ plan, id }: { plan: Plan; id: string }) => setPlanPrice(plan, id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-pricing"] }),
  });
  if (!data) return null;

  const rows: { key: string; label: string; render: (p: AdminPlanPricing) => React.ReactNode }[] = [
    { key: "tagline", label: "", render: (p) => <span className="text-xs text-[var(--faint)]">{p.tagline}</span> },
    {
      key: "retrievals",
      label: "Retrievals / mo",
      render: (p) =>
        p.limits.retrievalsPerMonth === null
          ? "Unlimited"
          : `${p.limits.retrievalsPerMonth.toLocaleString()}${p.limits.hardCap ? " (hard)" : ""}`,
    },
    { key: "seats", label: "Seats", render: () => "Unlimited" },
    {
      key: "repos",
      label: "Repos",
      render: (p) => (p.limits.maxRepos === null ? "Unlimited" : String(p.limits.maxRepos)),
    },
    { key: "reviewer", label: "PR reviewer", render: (p) => (p.limits.reviewer ? "✓" : "—") },
    { key: "audit", label: "Audit log", render: (p) => (p.limits.audit ? "✓" : "—") },
    { key: "byodb", label: "Data residency (BYODB)", render: (p) => (p.limits.byodb ? "✓" : "—") },
  ];

  return (
    <Card className="mt-6 p-0">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
        <div>
          <h2 className="font-display font-semibold">Pricing &amp; plans</h2>
          <p className="text-xs text-[var(--muted)]">
            The plan matrix (single source of truth). Set each paid plan&apos;s Stripe Price ID here —
            no redeploy.
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-0.5 text-xs ${data.stripeEnabled ? "border-[var(--verify)]/40 text-[var(--verify)]" : "border-[var(--border)] text-[var(--muted)]"}`}
        >
          Stripe {data.stripeEnabled ? "connected" : "off"}
        </span>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--faint)]">
              <th className="px-5 py-2.5 font-medium">Feature</th>
              {data.plans.map((p) => (
                <th key={p.plan} className="px-3 py-2.5 font-medium">
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 ${PLAN_STYLE[p.plan]}`}>
                    {p.label}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key} className="border-b border-[var(--border)] last:border-0">
                <td className="px-5 py-2.5 text-[var(--muted)]">{r.label}</td>
                {data.plans.map((p) => (
                  <td key={p.plan} className="px-3 py-2.5">
                    {r.render(p)}
                  </td>
                ))}
              </tr>
            ))}
            <tr>
              <td className="px-5 py-3 align-top text-[var(--muted)]">Stripe Price ID</td>
              {data.plans.map((p) => (
                <td key={p.plan} className="px-3 py-3 align-top">
                  {p.plan === "free" ? (
                    <span className="text-xs text-[var(--faint)]">—</span>
                  ) : (
                    <div className="space-y-1.5">
                      <Input
                        defaultValue={p.stripePriceId ?? ""}
                        placeholder="price_…"
                        className="w-40 font-mono text-xs"
                        onChange={(e) => setDrafts((d) => ({ ...d, [p.plan]: e.target.value }))}
                      />
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => save.mutate({ plan: p.plan, id: drafts[p.plan] ?? p.stripePriceId ?? "" })}
                          loading={save.isPending && save.variables?.plan === p.plan}
                        >
                          Save
                        </Button>
                        <span className="text-[10px] uppercase tracking-wide text-[var(--faint)]">
                          {p.priceSource}
                        </span>
                      </div>
                    </div>
                  )}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function money(cents: number) {
  return `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

function Overview() {
  const { data } = useQuery({ queryKey: ["admin-overview"], queryFn: getAdminOverview });
  if (!data) return null;
  const stats = [
    { label: "Users", value: String(data.totals.users) },
    { label: "Workspaces", value: String(data.totals.workspaces) },
    { label: "Repos", value: String(data.totals.repos) },
    { label: "MRR (31d)", value: money(data.mrrCents), accent: true },
  ];
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-5">
            <p className="text-sm text-[var(--muted)]">{s.label}</p>
            <p
              className="mt-1 text-3xl font-semibold"
              style={s.accent ? { color: "var(--signal)" } : undefined}
            >
              {s.value}
            </p>
          </Card>
        ))}
      </div>
      <Card className="p-5">
        <p className="mb-2 text-sm font-medium">Plans</p>
        <div className="flex flex-wrap gap-2">
          {PLANS.map((p) => (
            <span
              key={p}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${PLAN_STYLE[p]}`}
            >
              {p}
              <span className="font-semibold text-[var(--text)]">{data.plans[p] ?? 0}</span>
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Workspaces() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-workspaces"], queryFn: getAdminWorkspaces });
  const [editing, setEditing] = useState<AdminWorkspace | null>(null);

  return (
    <Card className="mt-6 p-0">
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h2 className="font-display font-semibold">Workspaces</h2>
        <p className="text-xs text-[var(--muted)]">
          Open one to manage members, plan, and deletion — or change plan inline.
        </p>
      </div>
      {isLoading ? (
        <p className="p-5 text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-[var(--faint)]">
                <th className="px-5 py-2.5 font-medium">Workspace</th>
                <th className="px-3 py-2.5 font-medium">Owner</th>
                <th className="px-3 py-2.5 font-medium">Plan</th>
                <th className="px-3 py-2.5 font-medium">Usage (mo)</th>
                <th className="px-3 py-2.5 font-medium">Size</th>
                <th className="px-5 py-2.5 text-right font-medium">Manage</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((w) => (
                <tr key={w.id} className="border-b border-[var(--border)] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-5 py-3">
                    <Link href={`/admin/workspaces/${w.id}`} className="block">
                      <div className="font-medium transition hover:text-[var(--accent)]">{w.name}</div>
                      <div className="text-xs text-[var(--faint)]">{w.slug}</div>
                    </Link>
                  </td>
                  <td className="px-3 py-3 text-[var(--muted)]">{w.owner?.email ?? "—"}</td>
                  <td className="px-3 py-3">
                    <span
                      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${PLAN_STYLE[w.plan]}`}
                    >
                      {w.plan}
                    </span>
                    {w.planSource === "comp" ? (
                      <span className="ml-1.5 text-[10px] uppercase text-[var(--verify)]">comp</span>
                    ) : null}
                    {w.planStatus !== "active" ? (
                      <span className="ml-1.5 text-[10px] uppercase text-[var(--alert)]">{w.planStatus}</span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">
                    <UsageMeter used={w.retrievals} limit={w.retrievalLimit} />
                  </td>
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">
                    {w.memberCount} member{w.memberCount === 1 ? "" : "s"} · {w.repoCount} repo
                    {w.repoCount === 1 ? "" : "s"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => setEditing(w)}>
                        Change plan
                      </Button>
                      <Link
                        href={`/admin/workspaces/${w.id}`}
                        className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-xs transition hover:border-[var(--border-strong)] hover:bg-white/5"
                      >
                        Manage →
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing ? <PlanModal ws={editing} onClose={() => setEditing(null)} /> : null}
    </Card>
  );
}

function UsageMeter({ used, limit }: { used: number; limit: number | null }) {
  const pct = limit === null ? 0 : Math.min(100, Math.round((used / limit) * 100));
  const over = limit !== null && used >= limit;
  return (
    <div className="w-28">
      <div className="flex items-center justify-between text-xs">
        <span className={over ? "text-[var(--signal)]" : "text-[var(--muted)]"}>{compactNum(used)}</span>
        <span className="text-[var(--faint)]">{limit === null ? "∞" : compactNum(limit)}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
        <div
          className="h-full rounded-full"
          style={{
            width: limit === null ? "12%" : `${pct}%`,
            background: over ? "var(--signal)" : "var(--accent)",
          }}
        />
      </div>
    </div>
  );
}

function PlanModal({ ws, onClose }: { ws: AdminWorkspace; onClose: () => void }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<Plan>(ws.plan);
  const [comp, setComp] = useState(ws.planSource === "comp");
  const [note, setNote] = useState(ws.planNote ?? "");

  const save = useMutation({
    mutationFn: () =>
      setWorkspacePlan(ws.id, {
        plan,
        source: comp ? "comp" : "manual",
        status: "active",
        note: note.trim() || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
      qc.invalidateQueries({ queryKey: ["admin-billing"] });
      onClose();
    },
  });

  return (
    <Modal open onClose={onClose} title={`Plan · ${ws.name}`} description="Set the plan, or comp it (promote for free).">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Plan</span>
          <Select value={plan} onChange={(e) => setPlan(e.target.value as Plan)}>
            {PLANS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={comp}
            onChange={(e) => setComp(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Comp this workspace (promote for free — no billing)
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-[var(--muted)]">Note (optional)</span>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. Design partner — comped through 2026."
          />
        </label>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} loading={save.isPending}>
            Save plan
          </Button>
        </div>
        {save.isError ? (
          <p className="text-sm text-[var(--alert)]">{(save.error as Error).message}</p>
        ) : null}
      </div>
    </Modal>
  );
}

function BillingLog() {
  const { data, isLoading } = useQuery({ queryKey: ["admin-billing"], queryFn: getBillingEvents });
  return (
    <Card className="mt-6 p-5">
      <h2 className="font-display font-semibold">Billing log</h2>
      <p className="text-xs text-[var(--muted)]">
        Plan grants and changes now; Stripe invoices &amp; payments once billing is wired.
      </p>
      {isLoading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No billing activity yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {data.map((e) => (
            <li key={e.id} className="flex items-start justify-between gap-3 py-2.5 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{e.type}</span>
                {e.plan ? <span className="text-[var(--muted)]"> · {e.plan}</span> : null}
                {e.status ? <span className="text-[var(--muted)]"> · {e.status}</span> : null}
                <div className="text-xs text-[var(--faint)]">
                  {e.workspace?.name ?? "—"}
                  {e.actorEmail ? ` · by ${e.actorEmail}` : ""}
                  {e.note ? ` · ${e.note}` : ""}
                </div>
              </div>
              <div className="shrink-0 text-right">
                {e.amountCents != null ? (
                  <div className="font-medium">{money(e.amountCents)}</div>
                ) : null}
                <div className="text-xs text-[var(--faint)]">
                  {new Date(e.createdAt).toLocaleString()}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
