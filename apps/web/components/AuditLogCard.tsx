"use client";

import { useQuery } from "@tanstack/react-query";
import { api, API_BASE_URL, timeAgo } from "../lib/api";
import { Card } from "./ui";

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  metadata: unknown;
  createdAt: string;
}

/** Workspace audit log (admin+). Export is a Business+ feature; the API returns
    402 plan_limit_audit on lower plans, which we render as an upgrade hint. */
export function AuditLogCard({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["audit", workspaceId],
    queryFn: () => api<AuditRow[]>(`/workspaces/${workspaceId}/audit`),
    retry: false,
  });

  const locked = (error as Error | undefined)?.message === "plan_limit_audit";

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Audit log</h2>
          <p className="text-xs text-[var(--muted)]">
            Who changed what — memory approvals, plan changes, member changes.
          </p>
        </div>
        {!locked && data && data.length > 0 ? (
          <a
            href={`${API_BASE_URL}/workspaces/${workspaceId}/audit.csv`}
            className="shrink-0 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs transition hover:border-[var(--border-strong)] hover:bg-white/5"
          >
            Download CSV
          </a>
        ) : null}
      </div>

      {locked ? (
        <div className="mt-4 rounded-lg border border-[var(--signal)]/30 bg-[var(--signal-soft)] p-3 text-sm">
          The audit log is a <span className="font-medium">Business</span> feature. Upgrade in the
          Billing tab to view and export it.
        </div>
      ) : isLoading ? (
        <p className="mt-4 text-sm text-[var(--muted)]">Loading…</p>
      ) : !data || data.length === 0 ? (
        <p className="mt-4 text-sm text-[var(--muted)]">No audit entries yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-[var(--border)]">
          {data.slice(0, 20).map((r) => (
            <li key={r.id} className="flex items-start justify-between gap-3 py-2 text-sm">
              <div className="min-w-0">
                <span className="font-medium">{r.action}</span>{" "}
                <span className="text-[var(--muted)]">{r.entityType}</span>
                <div className="truncate text-xs text-[var(--faint)]">
                  {r.actor}
                  {typeof r.metadata === "object" && r.metadata
                    ? ` · ${JSON.stringify(r.metadata)}`
                    : ""}
                </div>
              </div>
              <span
                className="shrink-0 text-xs text-[var(--faint)]"
                title={new Date(r.createdAt).toLocaleString()}
              >
                {timeAgo(r.createdAt)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
