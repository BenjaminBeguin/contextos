"use client";

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type AgentSessionSummary } from "../../../lib/api";
import { AppShell } from "../../../components/AppShell";
import { RepoNav } from "../../../components/RepoNav";
import { Button, Card } from "../../../components/ui";

interface RepoDetail {
  id: string;
  fullName: string;
  provider: string;
  stack: string[];
  packageManager: string | null;
  notes: string | null;
  workspace?: { name: string };
  memoryCounts: { status: string; _count: number }[];
  viewerRole?: string;
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

      <RepoContextCard repo={repo} repoId={repoId} />

      <SessionsPanel repoId={repoId} />

      <div className="mt-6 flex gap-3 text-sm">
        <Link href={`/repos/${repoId}/memories`} className="text-[var(--accent)]">
          Browse memory library →
        </Link>
        <Link href={`/repos/${repoId}/setup`} className="text-[var(--accent)]">
          Connect Claude Code →
        </Link>
      </div>

      {repo.viewerRole === "owner" ? (
        <DangerZone repoId={repoId} fullName={repo.fullName} />
      ) : null}
    </div>
  );
}

function RepoContextCard({ repo, repoId }: { repo: RepoDetail; repoId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [stack, setStack] = useState(repo.stack.join(", "));
  const [packageManager, setPackageManager] = useState(repo.packageManager ?? "");
  const [notes, setNotes] = useState(repo.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      api(`/repos/${repoId}`, {
        method: "PATCH",
        body: JSON.stringify({
          stack: stack
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          packageManager: packageManager.trim(),
          notes: notes.trim(),
        }),
      }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["repo", repoId] });
    },
  });

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Repo context</h2>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="text-xs text-[var(--muted)] hover:text-white">
            Edit
          </button>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Used by <code>get_repo_context</code> and the generated docs.
      </p>

      {editing ? (
        <div className="mt-4 space-y-3 text-sm">
          <Field label="Stack (comma-separated)">
            <input
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              placeholder="Node.js, PostgreSQL, Redis"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </Field>
          <Field label="Package manager">
            <input
              value={packageManager}
              onChange={(e) => setPackageManager(e.target.value)}
              placeholder="pnpm"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What this repo does, conventions, anything agents should know."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setStack(repo.stack.join(", "));
                setPackageManager(repo.packageManager ?? "");
                setNotes(repo.notes ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Stack" value={repo.stack.join(", ") || "—"} />
          <Row label="Package manager" value={repo.packageManager ?? "—"} />
          <Row label="Notes" value={repo.notes ?? "—"} />
        </dl>
      )}
    </Card>
  );
}

function DangerZone({ repoId, fullName }: { repoId: string; fullName: string }) {
  const router = useRouter();
  const remove = useMutation({
    mutationFn: () => api(`/repos/${repoId}`, { method: "DELETE" }),
    onSuccess: () => router.push("/dashboard"),
  });

  return (
    <Card className="mt-8 border-red-500/30 p-6">
      <h2 className="font-semibold text-red-300">Danger zone</h2>
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--muted)]">
          Disconnect <strong>{fullName}</strong> and permanently delete its memories, sessions, and
          docs. This cannot be undone.
        </p>
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Disconnect ${fullName}? This deletes all its memory and cannot be undone.`)) {
              remove.mutate();
            }
          }}
        >
          {remove.isPending ? "Disconnecting…" : "Disconnect repo"}
        </Button>
      </div>
      {remove.isError ? (
        <p className="mt-2 text-sm text-red-400">{(remove.error as Error).message}</p>
      ) : null}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
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
