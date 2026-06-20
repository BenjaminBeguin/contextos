"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type Me, type RepoSummary, type Workspace } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { useActiveWorkspace } from "../../lib/workspace";
import { projectColor } from "../../lib/projectColor";
import { Button, Card, Input, PageHeader } from "../../components/ui";

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
  if (me.workspaces.length === 0) return <ProjectGate />;
  return <ProjectsList me={me} />;
}

/** Create-or-join project (workspace) forms. */
function ProjectForms({ onDone }: { onDone?: (workspaceId?: string) => void }) {
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
    onSuccess: (ws) => {
      refresh();
      onDone?.(ws.id);
    },
  });

  const join = useMutation({
    mutationFn: () =>
      api<{ id?: string }>("/workspaces/join", {
        method: "POST",
        body: JSON.stringify({ joinCode }),
      }),
    onSuccess: (res) => {
      refresh();
      onDone?.(res?.id);
    },
  });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Card className="p-6">
        <h2 className="font-semibold">Create a project</h2>
        <div className="mt-4 space-y-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Project name" />
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="slug (optional)" />
          <Button onClick={() => create.mutate()} disabled={!name} loading={create.isPending}>
            {create.isPending ? "Creating…" : "Create project"}
          </Button>
          {create.isError ? (
            <p className="text-sm text-red-400">{(create.error as Error).message}</p>
          ) : null}
        </div>
      </Card>

      <Card className="p-6">
        <h2 className="font-semibold">Join a project</h2>
        <div className="mt-4 space-y-3">
          <Input
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="Join code (e.g. WS-1A2B3C4D)"
          />
          <Button onClick={() => join.mutate()} disabled={!joinCode} loading={join.isPending}>
            {join.isPending ? "Joining…" : "Join project"}
          </Button>
          {join.isError ? <p className="text-sm text-red-400">{(join.error as Error).message}</p> : null}
        </div>
      </Card>
    </div>
  );
}

function ProjectGate() {
  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-2xl font-semibold">Get started</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Projects are shared by your team. Create one, or join an existing project with its code.
      </p>
      <div className="mt-6">
        <ProjectForms />
      </div>
    </div>
  );
}

function ProjectsList({ me }: { me: Me }) {
  const { data: repos } = useQuery({ queryKey: ["repos"], queryFn: () => api<RepoSummary[]>("/repos") });
  const { setActiveId } = useActiveWorkspace();
  const [showForm, setShowForm] = useState(false);

  const repoCount = (slug: string) => repos?.filter((r) => r.workspace?.slug === slug).length ?? 0;

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Your teams and their connected repos."
        actions={
          <Button onClick={() => setShowForm((v) => !v)}>{showForm ? "Cancel" : "New project"}</Button>
        }
      />

      {showForm ? (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold">New project</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Create a separate project for another team, or join one with its code.
          </p>
          <div className="mt-4">
            <ProjectForms
              onDone={(id) => {
                if (id) setActiveId(id);
                setShowForm(false);
              }}
            />
          </div>
        </Card>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {me.workspaces.map((w) => (
          <Link key={w.id} href={`/projects/${w.id}`} className="group" onClick={() => setActiveId(w.id)}>
            <Card hover className="h-full overflow-hidden p-5">
              <div
                className="-mx-5 -mt-5 mb-4 h-1.5"
                style={{ background: projectColor(w.id).color }}
              />
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold transition group-hover:text-[var(--accent)]">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: projectColor(w.id).color }}
                  />
                  {w.name}
                </h3>
                <span className="shrink-0 text-xs text-[var(--muted)]">{w.role}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">{repoCount(w.slug)} repos</p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
