"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, getOrgs, type Me, type Workspace } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ProjectForms } from "../../components/ProjectForms";
import { useActiveWorkspace } from "../../lib/workspace";
import { projectColor } from "../../lib/projectColor";
import { PLAN_LABELS } from "@cortex/shared";
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

function Organizations() {
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: getOrgs });
  if (!orgs || orgs.length === 0) return null;
  return (
    <div className="mt-6">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Organizations
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {orgs.map((o) => (
          <Link key={o.id} href={`/orgs/${o.id}`} className="group">
            <Card hover className="flex items-center justify-between p-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium transition group-hover:text-[var(--accent)]">{o.name}</span>
                  <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                    {PLAN_LABELS[o.plan]}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-[var(--faint)]">
                  {o.projectCount} project{o.projectCount === 1 ? "" : "s"} · {o.memberCount} member
                  {o.memberCount === 1 ? "" : "s"}
                </p>
              </div>
              <span className="shrink-0 text-[var(--faint)] transition group-hover:text-[var(--accent)]">→</span>
            </Card>
          </Link>
        ))}
      </div>
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

      <Organizations />

      <h2 className="mt-8 mb-3 font-display text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Projects
      </h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((w) => (
          <Link key={w.id} href={`/projects/${w.id}`} className="group" onClick={() => setActiveId(w.id)}>
            <Card hover className="relative h-full overflow-hidden p-5 transition-shadow duration-300">
              {/* project-tinted top edge that fades out, + a soft glow on hover */}
              <div
                className="-mx-5 -mt-5 mb-4 h-1"
                style={{
                  background: `linear-gradient(90deg, ${projectColor(w.id).color}, transparent 85%)`,
                }}
              />
              <div
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full opacity-0 blur-2xl transition-opacity duration-300 group-hover:opacity-25"
                style={{ background: projectColor(w.id).color }}
                aria-hidden
              />
              <div className="flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 font-semibold transition group-hover:text-[var(--accent)]">
                  <span
                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ background: projectColor(w.id).color, boxShadow: `0 0 10px ${projectColor(w.id).color}` }}
                  />
                  {w.name}
                </h3>
                <span className="shrink-0 rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                  {w.role}
                </span>
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs text-[var(--muted)]">
                <span>{w.repoCount ?? 0} repos</span>
                {(w.pendingMemories ?? 0) > 0 ? (
                  <span
                    className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-medium"
                    style={{
                      background: "var(--signal-soft)",
                      color: "var(--signal)",
                    }}
                  >
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--signal)]" />
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
