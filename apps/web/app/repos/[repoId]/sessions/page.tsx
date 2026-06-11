"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type AgentSession } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { Card, StatusBadge } from "../../../../components/ui";

export default function SessionsPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <Sessions repoId={repoId} />
    </AppShell>
  );
}

function Sessions({ repoId }: { repoId: string }) {
  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions", repoId],
    queryFn: () => api<AgentSession[]>(`/repos/${repoId}/sessions`),
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Agent sessions</h1>
      <p className="text-sm text-[var(--muted)]">
        Sessions captured from Claude Code via{" "}
        <code>record_session_summary</code>. Each one proposes memories that land in your{" "}
        <Link href={`/repos/${repoId}/inbox`} className="text-[var(--accent)]">
          inbox
        </Link>{" "}
        for review.
      </p>

      <div className="mt-6 space-y-4">
        {isLoading ? <p className="text-[var(--muted)]">Loading…</p> : null}
        {sessions?.length === 0 ? (
          <p className="text-[var(--muted)]">
            No sessions yet. When Claude Code finishes a task in this repo it will record one here.
          </p>
        ) : null}
        {sessions?.map((s) => (
          <Card key={s.id} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <StatusBadge status={s.status} />
                  <span className="text-xs text-[var(--muted)]">{s.agent}</span>
                  <span className="text-xs text-[var(--muted)]">
                    {new Date(s.createdAt).toLocaleString()}
                  </span>
                </div>
                <h3 className="font-semibold">{s.task ?? "Untitled session"}</h3>
                {s.summary ? (
                  <p className="mt-1 line-clamp-3 text-sm text-[var(--muted)]">{s.summary}</p>
                ) : null}
              </div>
              <span className="shrink-0 text-xs text-[var(--muted)]">
                {s._count?.events ?? 0} events
              </span>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
