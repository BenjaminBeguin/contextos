"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me, type WorkspaceMetrics } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ToolBreadcrumb } from "../../components/ToolBreadcrumb";
import { useActiveWorkspace } from "../../lib/workspace";
import { Card, PageHeader, Skeleton } from "../../components/ui";

export default function UsagePage() {
  return (
    <AppShell>
      <Usage />
    </AppShell>
  );
}

function Usage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { activeId: activeWs } = useActiveWorkspace();

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
      <ToolBreadcrumb section="Impact" />
      <PageHeader
        title="Impact"
        description="What Cortex is doing for this project — what your agents would be missing without it."
      />

      {isLoading || !metrics ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Context injected · 30d"
              value={metrics.contextInjections30}
              sub="agents primed with repo context"
            />
            <Stat
              label="Risky edits flagged · 30d"
              value={metrics.warningsMatched30}
              sub="warned before touching known-risk files"
            />
            <Stat
              label="Memory retrievals · 30d"
              value={metrics.retrievals30}
              sub={`${metrics.retrievals7} in the last 7d`}
            />
            <Stat
              label="Knowledge captured"
              value={metrics.approvedMemories}
              sub={`approved · ${metrics.pendingMemories} awaiting review`}
            />
          </div>

          <WithWithout metrics={metrics} />

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

function Stat({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value.toLocaleString()}</p>
      {sub ? <p className="mt-1 text-xs text-[var(--faint)]">{sub}</p> : null}
    </Card>
  );
}

function WithWithout({ metrics }: { metrics: WorkspaceMetrics }) {
  const coverage =
    metrics.reposCount > 0 ? Math.round((metrics.reposWithMemory / metrics.reposCount) * 100) : 0;
  return (
    <div className="mt-6 grid gap-4 lg:grid-cols-2">
      <Card className="border-red-500/15 bg-red-500/[0.03] p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-red-300/80">
          Without Cortex
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          Every session starts cold — no architecture, commands, or past failures. Agents rediscover
          the codebase each time, repeat known mistakes, and edit risky files blind.
        </p>
      </Card>
      <Card className="border-cyan-400/30 p-6">
        <p className="text-xs font-medium uppercase tracking-widest text-cyan-300">With Cortex</p>
        <ul className="mt-3 space-y-1.5 text-sm text-[var(--muted)]">
          <li>
            <span className="text-white">{metrics.contextInjections30.toLocaleString()}</span> sessions
            opened with your stack, commands, and risks pre-loaded (30d).
          </li>
          <li>
            <span className="text-white">{metrics.warningsMatched30.toLocaleString()}</span> risky-file
            edits flagged from known failures before they happened.
          </li>
          <li>
            <span className="text-white">{metrics.approvedMemories.toLocaleString()}</span> approved
            memories serving every agent · <span className="text-white">{coverage}%</span> of repos
            covered.
          </li>
        </ul>
      </Card>
    </div>
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
