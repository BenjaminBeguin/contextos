"use client";

import { useActiveWorkspace } from "../lib/workspace";
import { Select } from "./ui";

/** Global, always-visible indicator + switcher for the active workspace. */
export function WorkspaceSwitcher() {
  const { workspaces, activeId, setActiveId } = useActiveWorkspace();
  if (workspaces.length === 0) return null;

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-[var(--faint)] lg:inline">Workspace</span>
      <Select
        value={activeId}
        onChange={(e) => setActiveId(e.target.value)}
        aria-label="Active workspace"
        className="font-medium"
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
