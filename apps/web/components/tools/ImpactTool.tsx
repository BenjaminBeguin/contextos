"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type WorkspaceMetrics } from "../../lib/api";
import { Card, Skeleton } from "../ui";

/** Impact dashboard — what Cortex is doing for a project. */
export function ImpactTool({ workspaceId }: { workspaceId: string }) {
  const { data: metrics, isLoading } = useQuery({
    queryKey: ["metrics", workspaceId],
    queryFn: () => api<WorkspaceMetrics>(`/workspaces/${workspaceId}/metrics`),
    enabled: !!workspaceId,
  });

  if (isLoading || !metrics) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
      <MeasuredComparison metrics={metrics} />

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

function MeasuredComparison({ metrics }: { metrics: WorkspaceMetrics }) {
  const { withMemory, withoutMemory } = metrics.comparison;
  const total = withMemory.sessions + withoutMemory.sessions;
  const delta =
    withoutMemory.avgErrors > 0
      ? Math.round((1 - withMemory.avgErrors / withoutMemory.avgErrors) * 100)
      : null;

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Measured impact · errors per session (30d)</h2>
        <span className="text-xs text-[var(--faint)]">{total} sessions</span>
      </div>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Comparing sessions where Cortex memory was retrieved against those where it wasn&apos;t.
      </p>
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-xs text-[var(--muted)]">With memory</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-300">{withMemory.avgErrors}</p>
          <p className="mt-1 text-xs text-[var(--faint)]">avg errors · {withMemory.sessions} sessions</p>
        </div>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-xs text-[var(--muted)]">Without memory</p>
          <p className="mt-1 text-2xl font-semibold text-red-300">{withoutMemory.avgErrors}</p>
          <p className="mt-1 text-xs text-[var(--faint)]">
            avg errors · {withoutMemory.sessions} sessions
          </p>
        </div>
      </div>
      {delta !== null && withMemory.sessions > 0 && withoutMemory.sessions > 0 ? (
        <p className="mt-3 text-sm">
          <span className={delta >= 0 ? "text-emerald-300" : "text-red-300"}>
            {delta >= 0 ? `${delta}% fewer` : `${Math.abs(delta)}% more`}
          </span>{" "}
          errors per session with memory.
        </p>
      ) : (
        <p className="mt-3 text-xs text-[var(--faint)]">
          Needs sessions both with and without memory to compute a delta — keep using Claude Code and
          this fills in.
        </p>
      )}
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
