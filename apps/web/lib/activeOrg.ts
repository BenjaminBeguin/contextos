"use client";

import { useSyncExternalStore } from "react";
import { useQuery } from "@tanstack/react-query";
import { getOrgs } from "./api";
import { useActiveWorkspace } from "./workspace";

const KEY = "cortex.activeOrg";
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

/** Set the org you're "in" (e.g. clicking its rail chip) and notify subscribers. */
export function setActiveOrgId(id: string): void {
  if (typeof localStorage === "undefined") return;
  if (localStorage.getItem(KEY) === id) return;
  localStorage.setItem(KEY, id);
  listeners.forEach((l) => l());
}

export interface ActiveOrg {
  id: string;
  name: string;
}

/**
 * The organization the user is currently in — what new projects get scoped to.
 * Prefers an explicitly-selected org (a rail chip), then the active project's
 * org, then the first org. Null only when the user belongs to no org.
 */
export function useActiveOrg(): ActiveOrg | null {
  const stored = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: getOrgs });
  const { active } = useActiveWorkspace();
  const list = orgs ?? [];

  const chosen =
    (stored && list.find((o) => o.id === stored)) ||
    (active?.organizationId ? list.find((o) => o.id === active.organizationId) : undefined) ||
    list[0];
  return chosen ? { id: chosen.id, name: chosen.name } : null;
}
