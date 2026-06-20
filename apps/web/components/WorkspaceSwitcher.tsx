"use client";

import { useActiveWorkspace } from "../lib/workspace";
import { projectColor } from "../lib/projectColor";
import { Select } from "./ui";

/** Global, always-visible indicator + switcher for the active project, color-coded. */
export function WorkspaceSwitcher() {
  const { workspaces, activeId, setActiveId } = useActiveWorkspace();
  if (workspaces.length === 0) return null;
  const { color } = projectColor(activeId);

  return (
    <div
      className="flex items-center gap-2 rounded-lg border bg-[var(--surface-2)] pl-2.5"
      style={{ borderColor: color }}
    >
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: color, boxShadow: `0 0 8px ${color}` }}
        aria-hidden
      />
      <span className="hidden text-xs text-[var(--faint)] lg:inline">Project</span>
      <Select
        value={activeId}
        onChange={(e) => setActiveId(e.target.value)}
        aria-label="Active project"
        className="font-medium [&>select]:border-transparent [&>select]:bg-transparent"
      >
        {workspaces.map((w) => (
          <option key={w.id} value={w.id}>
            {w.name}
          </option>
        ))}
      </Select>
    </div>
  );
}
