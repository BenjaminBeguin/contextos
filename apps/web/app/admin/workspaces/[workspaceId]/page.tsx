"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  getAdminWhoami,
  getAdminWorkspace,
  getAdminWorkspaceUsage,
  adminAddMember,
  adminRemoveMember,
  adminDeleteWorkspace,
  setWorkspacePlan,
  type AdminWorkspaceDetail,
  type Plan,
} from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { Breadcrumb, Button, Card, EmptyState, Input, Select, Spinner } from "../../../../components/ui";

const PLANS: Plan[] = ["free", "scale", "enterprise"];

export default function AdminWorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = use(params);
  return (
    <AppShell>
      <Guarded workspaceId={workspaceId} />
    </AppShell>
  );
}

function Guarded({ workspaceId }: { workspaceId: string }) {
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
    return <EmptyState title="Not authorized" description="The admin area is superadmin-only." />;
  return <Manage workspaceId={workspaceId} />;
}

function Manage({ workspaceId }: { workspaceId: string }) {
  const { data: ws, isLoading } = useQuery({
    queryKey: ["admin-workspace", workspaceId],
    queryFn: () => getAdminWorkspace(workspaceId),
    retry: false,
  });

  if (isLoading) return <p className="text-[var(--muted)]">Loading…</p>;
  if (!ws) return <EmptyState title="Workspace not found" />;

  return (
    <div>
      <Breadcrumb items={[{ label: "Admin", href: "/admin" }, { label: ws.name }]} />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">{ws.name}</h1>
          <p className="text-sm text-[var(--muted)]">
            {ws.slug} · {ws.repos.length} repo{ws.repos.length === 1 ? "" : "s"} · join code{" "}
            <code className="rounded bg-black/40 px-1.5 py-0.5 text-xs">{ws.joinCode}</code>
          </p>
        </div>
        <PlanControl ws={ws} />
      </div>

      <UsageCard workspaceId={ws.id} />
      <MembersCard ws={ws} />
      <ReposCard ws={ws} />
      <DangerZone ws={ws} />
    </div>
  );
}

function UsageCard({ workspaceId }: { workspaceId: string }) {
  const { data } = useQuery({
    queryKey: ["admin-workspace-usage", workspaceId],
    queryFn: () => getAdminWorkspaceUsage(workspaceId),
  });
  if (!data) return null;
  const max = Math.max(1, ...data.history.map((h) => h.count));
  const thisMonth = data.history[0]?.count ?? 0;
  const limit = data.limit;
  const pct = limit === null ? 0 : Math.min(100, Math.round((thisMonth / limit) * 100));
  const over = limit !== null && thisMonth >= limit;

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">Retrieval usage</h2>
          <p className="text-xs text-[var(--muted)]">
            Memory pulls per month. This month vs the {data.plan} allotment
            {limit === null ? " (unlimited)" : ` (${limit.toLocaleString()})`}.
          </p>
        </div>
        <div className="text-right">
          <div className={`text-2xl font-semibold tabular-nums ${over ? "text-[var(--signal)]" : ""}`}>
            {thisMonth.toLocaleString()}
          </div>
          {limit !== null ? <div className="text-xs text-[var(--faint)]">{pct}% of plan</div> : null}
        </div>
      </div>

      {limit !== null ? (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--surface-3)]">
          <div
            className="h-full rounded-full"
            style={{ width: `${pct}%`, background: over ? "var(--signal)" : "var(--accent)" }}
          />
        </div>
      ) : null}

      <div className="mt-5 flex items-end gap-2">
        {[...data.history].reverse().map((h) => (
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
        {data.history.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No retrievals recorded yet.</p>
        ) : null}
      </div>
    </Card>
  );
}

function PlanControl({ ws }: { ws: AdminWorkspaceDetail }) {
  const qc = useQueryClient();
  const [plan, setPlan] = useState<Plan>(ws.plan);
  const save = useMutation({
    mutationFn: (p: Plan) => setWorkspacePlan(ws.id, { plan: p, source: "manual" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-workspace", ws.id] });
      qc.invalidateQueries({ queryKey: ["admin-workspaces"] });
      qc.invalidateQueries({ queryKey: ["admin-overview"] });
    },
  });
  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-[var(--muted)]">Plan</span>
      <Select
        value={plan}
        onChange={(e) => {
          const p = e.target.value as Plan;
          setPlan(p);
          save.mutate(p);
        }}
      >
        {PLANS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </Select>
      {ws.planSource === "comp" ? (
        <span className="text-[10px] uppercase text-[var(--verify)]">comp</span>
      ) : null}
    </div>
  );
}

function MembersCard({ ws }: { ws: AdminWorkspaceDetail }) {
  const qc = useQueryClient();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("member");
  const invalidate = () => qc.invalidateQueries({ queryKey: ["admin-workspace", ws.id] });

  const add = useMutation({
    mutationFn: () => adminAddMember(ws.id, email.trim(), role),
    onSuccess: () => {
      setEmail("");
      invalidate();
    },
  });
  const remove = useMutation({
    mutationFn: (userId: string) => adminRemoveMember(ws.id, userId),
    onSuccess: invalidate,
  });

  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold">Members ({ws.members.length})</h2>
      <ul className="mt-4 divide-y divide-[var(--border)]">
        {ws.members.map((m) => (
          <li key={m.userId} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <span className="min-w-0">
              <span className="font-medium">{m.name ?? m.email}</span>
              <span className="ml-2 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                {m.role}
              </span>
              <span className="block text-xs text-[var(--faint)]">{m.email}</span>
            </span>
            <Button
              variant="danger"
              size="sm"
              onClick={() => remove.mutate(m.userId)}
              disabled={remove.isPending}
            >
              Remove
            </Button>
          </li>
        ))}
      </ul>
      {remove.isError ? (
        <p className="mt-2 text-sm text-[var(--alert)]">{(remove.error as Error).message}</p>
      ) : null}

      <div className="mt-4 border-t border-[var(--border)] pt-4">
        <p className="mb-2 text-sm font-medium">Add a member</p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@company.com"
            className="min-w-56 flex-1"
          />
          <Select value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="owner">owner</option>
            <option value="admin">admin</option>
            <option value="member">member</option>
            <option value="viewer">viewer</option>
          </Select>
          <Button onClick={() => add.mutate()} disabled={!email.trim()} loading={add.isPending}>
            Add
          </Button>
        </div>
        {add.isError ? (
          <p className="mt-2 text-sm text-[var(--alert)]">{(add.error as Error).message}</p>
        ) : null}
        <p className="mt-2 text-xs text-[var(--faint)]">
          The person must already have a Memmo account.
        </p>
      </div>
    </Card>
  );
}

function ReposCard({ ws }: { ws: AdminWorkspaceDetail }) {
  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold">Repos ({ws.repos.length})</h2>
      {ws.repos.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No repos connected.</p>
      ) : (
        <ul className="mt-3 divide-y divide-[var(--border)]">
          {ws.repos.map((r) => (
            <li key={r.id} className="flex items-center justify-between py-2.5 text-sm">
              <span>{r.fullName}</span>
              <span className="text-xs text-[var(--faint)]">{r.memories} memories</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function DangerZone({ ws }: { ws: AdminWorkspaceDetail }) {
  const router = useRouter();
  const del = useMutation({
    mutationFn: () => adminDeleteWorkspace(ws.id),
    onSuccess: () => router.push("/admin"),
  });
  return (
    <Card className="mt-6 border-red-500/30 p-6">
      <h2 className="font-semibold text-red-300">Danger zone</h2>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <p className="text-sm text-[var(--muted)]">
          Delete <strong>{ws.name}</strong> and everything in it — repos, memories, sessions, reviews,
          members. This cannot be undone.
        </p>
        <Button
          variant="danger"
          disabled={del.isPending}
          onClick={() => {
            if (
              window.confirm(`Delete ${ws.name}? This permanently removes all its data and members.`)
            ) {
              del.mutate();
            }
          }}
        >
          {del.isPending ? "Deleting…" : "Delete workspace"}
        </Button>
      </div>
      {del.isError ? (
        <p className="mt-2 text-sm text-[var(--alert)]">{(del.error as Error).message}</p>
      ) : null}
    </Card>
  );
}
