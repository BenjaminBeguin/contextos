"use client";

import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { ToolBreadcrumb } from "../../components/ToolBreadcrumb";
import { GraphTool } from "../../components/tools/GraphTool";
import { useActiveWorkspace } from "../../lib/workspace";

export default function GraphPage() {
  return (
    <AppShell>
      <Graph />
    </AppShell>
  );
}

function Graph() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { activeId } = useActiveWorkspace();

  if (me && me.workspaces.length === 0) return null;

  return (
    <div>
      <ToolBreadcrumb section="Graph" />
      <h1 className="text-2xl font-semibold">Knowledge graph</h1>
      <div className="mt-4">
        <GraphTool workspaceId={activeId} />
      </div>
    </div>
  );
}
