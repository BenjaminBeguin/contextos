"use client";

import { useActiveWorkspace } from "../lib/workspace";
import { projectColor } from "../lib/projectColor";
import { Breadcrumb } from "./ui";

/** Breadcrumb for the project-scoped tool pages (Search, Chat, Graph, Usage). */
export function ToolBreadcrumb({ section }: { section: string }) {
  const { activeId, active } = useActiveWorkspace();
  return (
    <Breadcrumb
      items={[
        { label: "Projects", href: "/dashboard" },
        {
          label: active?.name ?? "Project",
          href: `/projects/${activeId}`,
          color: projectColor(activeId).color,
        },
        { label: section },
      ]}
    />
  );
}
