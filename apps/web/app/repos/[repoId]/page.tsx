"use client";

import { use } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
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
