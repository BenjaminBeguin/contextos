"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ToolBreadcrumb } from "../../components/ToolBreadcrumb";
import { SearchTool } from "../../components/tools/SearchTool";
import { useActiveWorkspace } from "../../lib/workspace";
import { PageHeader } from "../../components/ui";

export default function SearchPage() {
  return (
    <AppShell>
      <Search />
    </AppShell>
  );
}

function Search() {
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
      <ToolBreadcrumb section="Search" />
      <PageHeader title="Search memory" description="Across every repo in this project." />
      <SearchTool workspaceId={activeId} />
    </div>
  );
}
