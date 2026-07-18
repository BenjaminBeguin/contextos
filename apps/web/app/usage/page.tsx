"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ToolBreadcrumb } from "../../components/ToolBreadcrumb";
import { ImpactTool } from "../../components/tools/ImpactTool";
import { useActiveWorkspace } from "../../lib/workspace";
import { PageHeader } from "../../components/ui";

export default function UsagePage() {
  return (
    <AppShell>
      <Usage />
    </AppShell>
  );
}

function Usage() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { activeId } = useActiveWorkspace();

  if (me && me.workspaces.length === 0) {
    return (
      <p className="text-[var(--muted)]">
        No workspace yet.{" "}
        <Link href="/dashboard" className="text-[var(--accent)]">
          Create one →
        </Link>
      </p>
    );
  }

  return (
    <div>
      <ToolBreadcrumb section="Impact" />
      <PageHeader
        title="Impact"
        description="What Memmo is doing for this project — what your agents would be missing without it."
      />
      <ImpactTool workspaceId={activeId} />
    </div>
  );
}
