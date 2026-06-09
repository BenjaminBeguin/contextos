"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Me, type RepoSummary, type Workspace } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { Button, Card } from "../../components/ui";

export default function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });

  if (!me) return null;
  if (me.workspaces.length === 0) return <WorkspaceGate />;

  return <Workspaces me={me} />;
}

/** Shown when the user belongs to no workspace: create one or join with a code. */
function WorkspaceGate() {
  const qc = useQueryClient();
  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["me"] });
    qc.invalidateQueries({ queryKey: ["repos"] });
  };

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api<Workspace>("/workspaces", {
        method: "POST",
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/[^a-z0-9-]/g, "-") }),
      }),
    onSuccess: refresh,
  });

  const join = useMutation({
    mutationFn: () =>
      api("/workspaces/join", { method: "POST", body: JSON.stringify({ joinCode }) }),
    onSuccess: refresh,
  });

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Get started</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Workspaces are shared by your team. Create one, or join an existing workspace with its code.
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <Card className="p-6">
          <h2 className="font-semibold">Create a workspace</h2>
          <div className="mt-4 space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Workspace name"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="slug (optional)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <Button onClick={() => create.mutate()} disabled={!name || create.isPending}>
              {create.isPending ? "Creating…" : "Create workspace"}
            </Button>
            {create.isError ? (
              <p className="text-sm text-red-400">{(create.error as Error).message}</p>
            ) : null}
          </div>
        </Card>

        <Card className="p-6">
          <h2 className="font-semibold">Join a workspace</h2>
          <div className="mt-4 space-y-3">
            <input
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Join code (e.g. WS-1A2B3C4D)"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <Button onClick={() => join.mutate()} disabled={!joinCode || join.isPending}>
              {join.isPending ? "Joining…" : "Join workspace"}
            </Button>
            {join.isError ? (
              <p className="text-sm text-red-400">{(join.error as Error).message}</p>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}

function Workspaces({ me }: { me: Me }) {
  const qc = useQueryClient();
  const { data: repos } = useQuery({ queryKey: ["repos"], queryFn: () => api<RepoSummary[]>("/repos") });

  const [activeWs, setActiveWs] = useState(me.workspaces[0]!.id);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");

  const workspace = me.workspaces.find((w) => w.id === activeWs) ?? me.workspaces[0]!;

  const createRepo = useMutation({
    mutationFn: () =>
      api<RepoSummary>("/repos", {
        method: "POST",
        body: JSON.stringify({ workspaceId: activeWs, name, fullName: name, provider: "github" }),
      }),
    onSuccess: () => {
      setName("");
      setShowForm(false);
      qc.invalidateQueries({ queryKey: ["repos"] });
    },
  });

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <div className="mt-1 flex items-center gap-2 text-sm text-[var(--muted)]">
            <span>Workspace:</span>
            <select
              value={activeWs}
              onChange={(e) => setActiveWs(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-2 py-1"
            >
              {me.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.role})
                </option>
              ))}
            </select>
          </div>
        </div>
        <Button onClick={() => setShowForm((v) => !v)}>Add repo</Button>
      </div>

      <Card className="mt-6 flex items-center justify-between p-4">
        <p className="text-sm text-[var(--muted)]">
          Invite teammates with this join code:
        </p>
        <code className="rounded-md border border-[var(--border)] bg-black/40 px-3 py-1 text-sm">
          {workspace.joinCode}
        </code>
      </Card>

      {showForm ? (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold">Connect a repo to {workspace.name}</h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="owner/repo"
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
            <Button onClick={() => createRepo.mutate()} disabled={!name || createRepo.isPending}>
              {createRepo.isPending ? "Creating…" : "Create"}
            </Button>
          </div>
          {createRepo.isError ? (
            <p className="mt-2 text-sm text-red-400">{(createRepo.error as Error).message}</p>
          ) : null}
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {repos?.length === 0 ? (
          <p className="text-[var(--muted)]">No repos yet. Add one to get started.</p>
        ) : null}
        {repos?.map((repo) => (
          <Link key={repo.id} href={`/repos/${repo.id}`}>
            <Card className="p-5 transition hover:border-[var(--accent)]">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">{repo.fullName}</h3>
                <span className="text-xs text-[var(--muted)]">
                  {repo._count?.memories ?? 0} memories
                </span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {repo.workspace?.name} · {repo.provider}
              </p>
              {repo.stack?.length ? (
                <div className="mt-3 flex flex-wrap gap-1">
                  {repo.stack.map((s) => (
                    <span
                      key={s}
                      className="rounded border border-[var(--border)] px-1.5 py-0.5 text-xs text-[var(--muted)]"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              ) : null}
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
