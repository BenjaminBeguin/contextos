"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { useActiveWorkspace } from "../../lib/workspace";
import { projectColor } from "../../lib/projectColor";
import { ProjectSettings, type SettingsSection } from "../../components/ProjectSettings";
import { Breadcrumb, PageHeader } from "../../components/ui";

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
  const [section, setSection] = useState<SettingsSection>("General");

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

  const projectName = me?.workspaces.find((w) => w.id === activeWs)?.name;

  return (
    <div className="max-w-5xl">
      <Breadcrumb
        items={[
          { label: "Projects", href: "/dashboard" },
          { label: projectName ?? "Project", href: `/projects/${activeWs}`, color: projectColor(activeWs).color },
          { label: "Settings" },
        ]}
      />
      <PageHeader
        title="Project settings"
        description={
          <>
            Your account settings live under{" "}
            <Link href="/account" className="text-[var(--accent)]">
              Account
            </Link>
            .
          </>
        }
      />
      {activeWs ? (
        <ProjectSettings
          key={activeWs}
          workspaceId={activeWs}
          isOwner={isOwner}
          section={section}
          onSection={setSection}
        />
      ) : null}
    </div>
  );
}
