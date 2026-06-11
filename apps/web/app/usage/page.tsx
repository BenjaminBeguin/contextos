"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me, type WorkspaceMetrics } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { Card } from "../../components/ui";

export default function UsagePage() {
  return (
    <AppShell>
      <Usage />
    </AppShell>
  );
}

function Usage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const [ws, setWs] = useState<string>("");
  const activeWs = ws || me?.workspaces[0]?.id || "";

  const { data: metrics, isLoading } = useQuery({
    queryKey: ["metrics", activeWs],
    queryFn: () => api<WorkspaceMetrics>(`/workspaces/${activeWs}/metrics`),
    enabled: !!activeWs,
  });

  if (me && me.workspaces.length === 0) {
    return (
      <p className="text-[var(--muted)]">
        No workspace yet.{" "}
        <Link href="/dashboard" className="text-[var(--accent)]">
          Create one →
        </Link>
      </p>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Usage</h1>
          <p className="text-sm text-[var(--muted)]">How your team is using ContextOS.</p>
        </div>
        <select
          value={activeWs}
          onChange={(e) => setWs(e.target.value)}
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1 text-sm"
        >
          {me?.workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {isLoading || !metrics ? (
        <p className="mt-6 text-[var(--muted)]">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Memory retrievals · 7d" value={metrics.retrievals7} />
            <Stat label="Memory retrievals · 30d" value={metrics.retrievals30} />
            <Stat label="Approved memories" value={metrics.approvedMemories} />
            <Stat label="Pending review" value={metrics.pendingMemories} />
          </div>

          <Card className="mt-6 p-6">
            <h2 className="font-semibold">Retrievals · last 14 days</h2>
            <RetrievalChart series={metrics.retrievalSeries} />
          </Card>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <Card className="p-6">
              <h2 className="font-semibold">Memory by status</h2>
              <StatusBars counts={metrics.memoryCounts} />
            </Card>
            <Card className="p-6">
              <h2 className="font-semibold">Top repos by memory</h2>
              {metrics.topRepos.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--muted)]">No repos yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {metrics.topRepos.map((r) => (
                    <li key={r.id} className="flex items-center justify-between text-sm">
                      <Link href={`/repos/${r.id}`} className="hover:text-white">
                        {r.fullName}
                      </Link>
                      <span className="text-[var(--muted)]">{r.memories}</span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value.toLocaleString()}</p>
    </Card>
  );
}

function RetrievalChart({ series }: { series: { date: string; count: number }[] }) {
  const max = Math.max(1, ...series.map((s) => s.count));
  return (
    <div className="mt-4 flex h-32 items-end gap-1.5">
      {series.map((s) => (
        <div key={s.date} className="group flex flex-1 flex-col items-center justify-end">
          <div
            className="w-full rounded-t bg-gradient-to-t from-[var(--accent)]/40 to-[var(--accent)] transition"
            style={{ height: `${(s.count / max) * 100}%`, minHeight: s.count > 0 ? 4 : 1 }}
            title={`${s.date}: ${s.count}`}
          />
          <span className="mt-1 text-[9px] text-[var(--muted)]">{s.date.slice(5)}</span>
        </div>
      ))}
    </div>
  );
}

const STATUS_COLORS: Record<string, string> = {
  approved: "bg-emerald-400",
  proposed: "bg-violet-400",
  rejected: "bg-red-400",
  archived: "bg-zinc-400",
  stale: "bg-yellow-400",
};

function StatusBars({ counts }: { counts: Record<string, number> }) {
  const entries = Object.entries(counts);
  const total = Math.max(1, entries.reduce((a, [, c]) => a + c, 0));
  if (entries.length === 0) {
    return <p className="mt-3 text-sm text-[var(--muted)]">No memories yet.</p>;
  }
  return (
    <div className="mt-4 space-y-3">
      {entries.map(([status, count]) => (
        <div key={status}>
          <div className="mb-1 flex justify-between text-xs">
            <span className="capitalize">{status}</span>
            <span className="text-[var(--muted)]">{count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-white/5">
            <div
              className={`h-full ${STATUS_COLORS[status] ?? "bg-white/40"}`}
              style={{ width: `${(count / total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
