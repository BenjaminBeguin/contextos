"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me, type Workspace } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ProjectForms } from "../../components/ProjectForms";
import { useActiveWorkspace } from "../../lib/workspace";
import { projectColor } from "../../lib/projectColor";
import { Button, Card, PageHeader } from "../../components/ui";

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
  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api<Workspace[]>("/workspaces"),
  });
  const { setActiveId } = useActiveWorkspace();
  const [showForm, setShowForm] = useState(false);
  const list = workspaces ?? me.workspaces;

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
        {list.map((w) => (
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
              <div className="mt-1 flex items-center gap-2 text-xs text-[var(--muted)]">
                <span>{w.repoCount ?? 0} repos</span>
                {(w.pendingMemories ?? 0) > 0 ? (
                  <span className="rounded-full bg-amber-500/15 px-2 py-0.5 font-medium text-amber-300">
                    {w.pendingMemories} to review
                  </span>
                ) : null}
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
