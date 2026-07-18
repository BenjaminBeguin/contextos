"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { api, type Me, type Workspace } from "./api";

const KEY = "memmo.activeWorkspace";
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
}

function getServerSnapshot(): string | null {
  return null;
}

/** Set the active workspace and notify every `useActiveWorkspace` subscriber. */
export function setActiveWorkspaceId(id: string): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(KEY) === id) return;
  localStorage.setItem(KEY, id);
  listeners.forEach((l) => l());
}

export interface ActiveWorkspace {
  workspaces: Workspace[];
  activeId: string;
  active: Workspace | null;
  setActiveId: (id: string) => void;
}

/**
 * Single source of truth for the selected workspace, shared across all pages and
 * persisted to localStorage. Falls back to the first workspace when nothing valid
 * is stored.
 */
export function useActiveWorkspace(): ActiveWorkspace {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const workspaces = me?.workspaces ?? [];

  const valid =
    stored && workspaces.some((w) => w.id === stored)
      ? stored
      : (workspaces[0]?.id ?? "");
  const active = workspaces.find((w) => w.id === valid) ?? null;

  return { workspaces, activeId: valid, active, setActiveId: setActiveWorkspaceId };
}
