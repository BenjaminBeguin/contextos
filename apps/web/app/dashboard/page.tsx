"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { PLAN_LABELS } from "@cortex/shared";
import { api, getOrgs, type Me, type Workspace } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ProjectForms } from "../../components/ProjectForms";
import { OrgForms } from "../../components/OrgForms";
import { CopyButton } from "../../components/CopyButton";
import { useActiveWorkspace } from "../../lib/workspace";
import { useActiveOrg } from "../../lib/activeOrg";
import { projectColor } from "../../lib/projectColor";
import { Button, Card, Modal, PageHeader } from "../../components/ui";

export default function DashboardPage() {
  return (
    <AppShell>
      <Dashboard />
    </AppShell>
  );
}

function Dashboard() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: getOrgs });
  if (!me || orgs === undefined) return null;
  // Brand-new users (no org, no project) get the onboarding gate; anyone in an
  // org sees the org-scoped project list (empty state included).
  if (me.workspaces.length === 0 && orgs.length === 0) return <ProjectGate />;
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
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: getOrgs });
  const { setActiveId } = useActiveWorkspace();
  const activeOrg = useActiveOrg();
  const [showForm, setShowForm] = useState(false);
  const [showOrg, setShowOrg] = useState(false);

  const allProjects = workspaces ?? me.workspaces;
  const org = orgs?.find((o) => o.id === activeOrg?.id) ?? null;
  // Everything on this page is scoped to the org you're currently in.
  const list = activeOrg
    ? allProjects.filter((w) => w.organizationId === activeOrg.id)
    : allProjects;

  return (
    <div>
      <PageHeader
        title={org?.name ?? activeOrg?.name ?? "Projects"}
        description={
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
            {org ? (
              <span className="rounded-full border border-[var(--border)] px-2 py-0.5 text-[10px] uppercase tracking-wide text-[var(--muted)]">
                {PLAN_LABELS[org.plan]}
              </span>
            ) : null}
            <span>
              {list.length} project{list.length === 1 ? "" : "s"}
            </span>
            {org ? (
              <span className="inline-flex items-center gap-1.5">
                <span className="text-[var(--faint)]">Join code</span>
                <code className="rounded bg-[var(--surface-2)] px-1.5 py-0.5 text-xs text-[var(--fg)]">
                  {org.joinCode}
                </code>
                <CopyButton value={org.joinCode} />
              </span>
            ) : null}
            {org ? (
              <Link href={`/orgs/${org.id}`} className="text-[var(--accent)] hover:underline">
                Manage organization →
              </Link>
            ) : null}
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => setShowOrg(true)}>
              New organization
            </Button>
            <Button onClick={() => setShowForm((v) => !v)}>
              {showForm ? "Cancel" : "New project"}
            </Button>
          </div>
        }
      />

      {showForm ? (
        <Card className="mt-6 p-6">
          <h2 className="font-semibold">New project</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            {activeOrg
              ? `Added to ${activeOrg.name}. Switch organizations from the sidebar.`
              : "Create a project for your team, or join one with its code."}
          </p>
          <div className="mt-4">
            <ProjectForms
              org={activeOrg}
              onDone={(id) => {
                if (id) setActiveId(id);
                setShowForm(false);
              }}
            />
          </div>
        </Card>
      ) : null}

      <Modal
        open={showOrg}
        onClose={() => setShowOrg(false)}
        title="Organizations"
        description="Create a new organization or join one with a code."
      >
        <OrgForms onDone={() => setShowOrg(false)} />
      </Modal>

      {list.length === 0 ? (
        <p className="mt-8 text-sm text-[var(--muted)]">
          No projects in {org?.name ?? "this organization"} yet — create one to get started.
        </p>
      ) : null}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
