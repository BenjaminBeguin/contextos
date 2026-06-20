"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { useActiveWorkspace } from "../../lib/workspace";
import { ProjectSettings } from "../../components/ProjectSettings";
import { PageHeader } from "../../components/ui";

export default function SettingsPage() {
  return (
    <AppShell>
      <Settings />
    </AppShell>
  );
}

function Settings() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { activeId: activeWs } = useActiveWorkspace();
  const role = me?.workspaces.find((w) => w.id === activeWs)?.role;
  const isOwner = role === "owner";

  if (me && me.workspaces.length === 0) {
    return (
      <p className="text-[var(--muted)]">
        No project yet.{" "}
        <Link href="/dashboard" className="text-[var(--accent)]">
          Create one →
        </Link>
      </p>
    );
  }

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Project settings"
        description={
          <>
            Settings for{" "}
            <span className="text-white">{me?.workspaces.find((w) => w.id === activeWs)?.name}</span>{" "}
            — switch project in the top bar. Your account settings live under{" "}
            <Link href="/account" className="text-[var(--accent)]">
              Account
            </Link>
            .
          </>
        }
      />
      {activeWs ? <ProjectSettings key={activeWs} workspaceId={activeWs} isOwner={isOwner} /> : null}
    </div>
  );
}
