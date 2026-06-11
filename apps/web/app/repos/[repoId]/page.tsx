"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type AgentSessionSummary } from "../../../lib/api";
import { AppShell } from "../../../components/AppShell";
import { RepoNav } from "../../../components/RepoNav";
import { Card } from "../../../components/ui";

interface RepoDetail {
  id: string;
  fullName: string;
  provider: string;
  stack: string[];
  packageManager: string | null;
  notes: string | null;
  workspace?: { name: string };
  memoryCounts: { status: string; _count: number }[];
}

export default function RepoPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <RepoOverview repoId={repoId} />
    </AppShell>
  );
}

function RepoOverview({ repoId }: { repoId: string }) {
  const { data: repo, isLoading } = useQuery({
    queryKey: ["repo", repoId],
    queryFn: () => api<RepoDetail>(`/repos/${repoId}`),
  });

  if (isLoading) return <p className="text-[var(--muted)]">Loading…</p>;
  if (!repo) return <p className="text-[var(--muted)]">Repo not found.</p>;

  const count = (status: string) =>
    repo.memoryCounts.find((c) => c.status === status)?._count ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{repo.fullName}</h1>
      <p className="text-sm text-[var(--muted)]">{repo.workspace?.name}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Approved" value={count("approved")} />
        <Stat label="Proposed (inbox)" value={count("proposed")} href={`/repos/${repoId}/inbox`} />
        <Stat label="Archived" value={count("archived")} />
      </div>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold">Repo context</h2>
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Stack" value={repo.stack.join(", ") || "—"} />
          <Row label="Package manager" value={repo.packageManager ?? "—"} />
          <Row label="Notes" value={repo.notes ?? "—"} />
        </dl>
      </Card>

      <SessionsPanel repoId={repoId} />

      <div className="mt-6 flex gap-3 text-sm">
        <Link href={`/repos/${repoId}/memories`} className="text-[var(--accent)]">
          Browse memory library →
        </Link>
        <Link href={`/repos/${repoId}/setup`} className="text-[var(--accent)]">
          Connect Claude Code →
        </Link>
      </div>
    </div>
  );
}

function SessionsPanel({ repoId }: { repoId: string }) {
  const { data: sessions } = useQuery({
    queryKey: ["sessions", repoId],
    queryFn: () => api<AgentSessionSummary[]>(`/repos/${repoId}/sessions`),
  });
  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold">Recent agent sessions</h2>
      {!sessions || sessions.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No sessions yet. Claude Code records them via{" "}
          <code>record_session_summary</code>; proposals land in your inbox.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-0">
              <div>
                <p className="text-sm">{s.task ?? "Untitled session"}</p>
                {s.summary ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{s.summary}</p>
                ) : null}
              </div>
              <span className="whitespace-nowrap text-xs text-[var(--muted)]">
                {new Date(s.createdAt).toLocaleDateString()} · {s.agent}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
