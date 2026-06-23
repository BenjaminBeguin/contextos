"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, type Me, type Workspace } from "../lib/api";
import { useActiveWorkspace } from "../lib/workspace";
import { projectColor } from "../lib/projectColor";
import { ProjectForms } from "./ProjectForms";
import { cn, Modal } from "./ui";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** A bottom-rail link (Documentation / Account) with active state + tooltip. */
function RailLink({
  href,
  label,
  active,
  children,
}: {
  href: string;
  label: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className={cn(
        "flex h-10 w-10 items-center justify-center rounded-xl border transition",
        active
          ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-white"
          : "border-transparent text-[var(--muted)] hover:bg-white/5 hover:text-white",
      )}
    >
      {children}
    </Link>
  );
}

/**
 * Slack-style vertical rail: switch between projects (workspaces) at the top,
 * Documentation / Account / Log out tucked into the bottom.
 */
export function WorkspaceRail() {
  const router = useRouter();
  const pathname = usePathname();
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me"), retry: false });
  const { data: workspaces } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => api<Workspace[]>("/workspaces"),
    retry: false,
    enabled: !!me,
  });
  const { activeId, setActiveId } = useActiveWorkspace();
  const list = workspaces ?? me?.workspaces ?? [];
  const [newOpen, setNewOpen] = useState(false);

  function open(id: string) {
    setActiveId(id);
    router.push(`/projects/${id}`);
  }

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  // The active project is highlighted on every project-scoped page (its hub, repos,
  // and the tools that read the active workspace) — but not on global pages like
  // the all-projects dashboard, Account, or Documentation.
  const PROJECT_SCOPED = ["/projects/", "/repos/", "/search", "/chat", "/graph", "/usage", "/settings"];
  const inProject = PROJECT_SCOPED.some((p) => pathname.startsWith(p));

  return (
    <aside className="sticky top-0 z-30 flex h-screen w-16 shrink-0 flex-col items-center gap-1.5 border-r border-[var(--border)] bg-[var(--background)]/95 py-3 backdrop-blur">
      {/* Logo */}
      <Link
        href="/dashboard"
        title="Cortex — all projects"
        aria-label="Cortex home"
        className="mb-1 flex h-10 w-10 items-center justify-center"
      >
        <span className="inline-block h-5 w-5 rotate-45 rounded-sm bg-gradient-to-br from-violet-400 to-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.45)]" />
      </Link>
      <div className="h-px w-7 bg-[var(--border)]" />

      {/* Projects */}
      <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto py-2">
        {list.map((w) => {
          const { color } = projectColor(w.id);
          const active = activeId === w.id && inProject;
          const pending = w.pendingMemories ?? 0;
          return (
            <button
              key={w.id}
              onClick={() => open(w.id)}
              title={w.name}
              aria-label={w.name}
              aria-current={active ? "page" : undefined}
              className="group relative flex h-10 w-10 items-center justify-center"
            >
              {/* active / hover indicator pill */}
              <span
                className={cn(
                  "absolute -left-3 w-1 rounded-r-full bg-white transition-all",
                  active ? "h-6" : "h-0 group-hover:h-3",
                )}
                aria-hidden
              />
              <span
                className={cn(
                  "flex h-10 w-10 items-center justify-center border text-sm font-semibold transition-all group-hover:rounded-xl",
                  active ? "rounded-xl" : "rounded-2xl",
                )}
                style={{
                  background: projectColor(w.id).soft,
                  color,
                  borderColor: active ? color : "transparent",
                }}
              >
                {initials(w.name)}
              </span>
              {pending > 0 ? (
                <span
                  className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-[var(--background)] bg-amber-500 px-1 text-[9px] font-bold text-black"
                  title={`${pending} memories awaiting review`}
                >
                  {pending}
                </span>
              ) : null}
            </button>
          );
        })}

        {/* New project — opens a modal with the create/join form */}
        <button
          onClick={() => setNewOpen(true)}
          title="New project"
          aria-label="New project"
          className="flex h-10 w-10 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] text-[var(--muted)] transition hover:rounded-xl hover:border-[var(--border-strong)] hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </nav>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New project"
        description="Create a separate project for another team, or join one with its code."
      >
        <ProjectForms
          onDone={(id) => {
            setNewOpen(false);
            if (id) {
              setActiveId(id);
              router.push(`/projects/${id}`);
            }
          }}
        />
      </Modal>

      {/* Bottom submenu: Documentation, Account, Log out */}
      <div className="flex flex-col items-center gap-1.5">
        <div className="my-1 h-px w-7 bg-[var(--border)]" />
        <RailLink href="/docs" label="Documentation" active={pathname.startsWith("/docs")}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M4 5.5A1.5 1.5 0 0 1 5.5 4H12v16H5.5A1.5 1.5 0 0 1 4 18.5v-13ZM20 5.5A1.5 1.5 0 0 0 18.5 4H12v16h6.5a1.5 1.5 0 0 0 1.5-1.5v-13Z"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          </svg>
        </RailLink>
        <RailLink href="/account" label="Account" active={pathname.startsWith("/account")}>
          {me?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={me.avatarUrl}
              alt=""
              className="h-7 w-7 rounded-full ring-1 ring-[var(--border)]"
            />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              <path
                d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
              />
            </svg>
          )}
        </RailLink>
        <button
          onClick={logout}
          title="Log out"
          aria-label="Log out"
          className="flex h-10 w-10 items-center justify-center rounded-xl border border-transparent text-[var(--muted)] transition hover:bg-white/5 hover:text-white"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M15 12H6m0 0 3-3m-3 3 3 3M14 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </aside>
  );
}
