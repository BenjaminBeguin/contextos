"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Me, type RepoSummary, type Workspace } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { RepoPicker } from "../../components/RepoPicker";
import { CopyButton } from "../../components/CopyButton";
import { Button, Card, Code } from "../../components/ui";

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
  const { data: repos } = useQuery({ queryKey: ["repos"], queryFn: () => api<RepoSummary[]>("/repos") });

  const [activeWs, setActiveWs] = useState(me.workspaces[0]!.id);
  const [showForm, setShowForm] = useState(false);

  const workspace = me.workspaces.find((w) => w.id === activeWs) ?? me.workspaces[0]!;

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
        <div className="flex items-center gap-2">
          <code className="rounded-md border border-[var(--border)] bg-black/40 px-3 py-1 text-sm">
            {workspace.joinCode}
          </code>
          <CopyButton value={workspace.joinCode} />
        </div>
      </Card>

      {showForm ? (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold">Connect a repo to {workspace.name}</h2>
          <div className="mt-4">
            <RepoPicker workspaceId={activeWs} onCreated={() => setShowForm(false)} />
          </div>
        </Card>
      ) : null}

      {repos && repos.length === 0 ? (
        <GettingStarted onAddRepo={() => setShowForm(true)} />
      ) : (
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      )}
    </div>
  );
}

function GettingStarted({ onAddRepo }: { onAddRepo: () => void }) {
  return (
    <Card className="mt-6 p-8">
      <h2 className="text-lg font-semibold">Get Cortex working in your repo</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Three steps and Claude Code starts retrieving your team&apos;s memory.
      </p>

      <div className="mt-8 space-y-8">
        <Step n={1} title="Add your first repository">
          <p className="text-sm text-[var(--muted)]">
            Connect a repo to this workspace. You can manage its memory, sessions, and docs here.
          </p>
          <div className="mt-3">
            <Button onClick={onAddRepo}>Add a repo</Button>
          </div>
        </Step>

        <Step n={2} title="Install the CLI and connect">
          <p className="text-sm text-[var(--muted)]">
            From your repo, install Cortex and link it. This generates{" "}
            <code>.mcp.json</code>, <code>CLAUDE.md</code>, and Claude Code hooks.
          </p>
          <div className="mt-3">
            <Code>{`npm install -g @mxbenjaminbeguin/cortex
cortex login
cortex init`}</Code>
          </div>
          <p className="mt-2 text-xs text-[var(--muted)]">
            Each repo also has a <strong>Claude Code setup</strong> tab with its exact command.
          </p>
        </Step>

        <Step n={3} title="Approve memories & let agents work">
          <p className="text-sm text-[var(--muted)]">
            Approve memories in the repo <strong>Inbox</strong> — only approved memories are served
            to agents. As Claude Code works, it records sessions that propose new memories for
            review, and your <strong>Usage</strong> metrics start filling in.
          </p>
        </Step>
      </div>
    </Card>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
        {n}
      </span>
      <div className="flex-1">
        <h3 className="font-semibold">{title}</h3>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
