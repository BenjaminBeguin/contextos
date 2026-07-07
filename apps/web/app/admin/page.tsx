"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminWhoami,
  getAdminOverview,
  getAdminWorkspaces,
  getBillingEvents,
  setWorkspacePlan,
  type AdminWorkspace,
  type Plan,
} from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import {
  Button,
  Card,
  EmptyState,
  Modal,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";

const PLANS: Plan[] = ["free", "team", "business", "enterprise"];

const PLAN_STYLE: Record<string, string> = {
  free: "bg-white/8 text-[var(--muted)] border-white/10",
  team: "bg-[var(--accent-soft)] text-[var(--accent-hover)] border-[var(--accent)]/30",
  business: "border-[var(--signal)]/30 text-[var(--signal)]",
  enterprise: "border-[var(--verify)]/30 text-[var(--verify)]",
};

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
      <Workspaces />
      <BillingLog />
    </div>
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
        <p className="text-xs text-[var(--muted)]">Manage each workspace&apos;s plan — comp, upgrade, or cancel.</p>
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
                <th className="px-3 py-2.5 font-medium">Size</th>
                <th className="px-5 py-2.5 text-right font-medium">Manage</th>
              </tr>
            </thead>
            <tbody>
              {(data ?? []).map((w) => (
                <tr key={w.id} className="border-b border-[var(--border)] last:border-0">
                  <td className="px-5 py-3">
                    <div className="font-medium">{w.name}</div>
                    <div className="text-xs text-[var(--faint)]">{w.slug}</div>
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
                  <td className="px-3 py-3 text-xs text-[var(--muted)]">
                    {w.memberCount} member{w.memberCount === 1 ? "" : "s"} · {w.repoCount} repo
                    {w.repoCount === 1 ? "" : "s"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <Button size="sm" variant="ghost" onClick={() => setEditing(w)}>
                      Change plan
                    </Button>
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
