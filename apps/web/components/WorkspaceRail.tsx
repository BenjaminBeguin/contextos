"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, getOrgs, type Me, type Workspace } from "../lib/api";
import { useActiveWorkspace } from "../lib/workspace";
import { useActiveOrg, setActiveOrgId } from "../lib/activeOrg";
import { projectColor } from "../lib/projectColor";
import { ProjectForms } from "./ProjectForms";
import { OrgForms } from "./OrgForms";
import { cn, Modal } from "./ui";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/** A row inside the user menu. */
function MenuLink({
  href,
  onClick,
  children,
}: {
  href: string;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      role="menuitem"
      className="block w-full px-3 py-2 text-left text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-white"
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
  const { data: admin } = useQuery({
    queryKey: ["admin-whoami"],
    queryFn: () => api<{ isSuperAdmin: boolean }>("/admin/whoami"),
    retry: false,
    enabled: !!me,
  });
  const { data: orgs } = useQuery({ queryKey: ["orgs"], queryFn: getOrgs, retry: false, enabled: !!me });
  const { activeId, setActiveId } = useActiveWorkspace();
  const activeOrg = useActiveOrg();
  const list = workspaces ?? me?.workspaces ?? [];
  const [newOpen, setNewOpen] = useState(false);
  const [newOrgOpen, setNewOrgOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

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

  const renderProject = (w: Workspace) => {
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
        className="group relative flex h-9 w-9 items-center justify-center"
      >
        <span
          className={cn(
            "absolute -left-3.5 w-1 rounded-r-full bg-white transition-all",
            active ? "h-5" : "h-0 group-hover:h-3",
          )}
          aria-hidden
        />
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center border text-xs font-semibold transition-all group-hover:rounded-xl",
            active ? "rounded-xl" : "rounded-2xl",
          )}
          style={{ background: projectColor(w.id).soft, color, borderColor: active ? color : "transparent" }}
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
  };

  const newProjectButton = (
    <button
      onClick={() => setNewOpen(true)}
      title="New project"
      aria-label="New project"
      className="flex h-9 w-9 items-center justify-center rounded-2xl border border-dashed border-[var(--border)] text-[var(--muted)] transition hover:rounded-xl hover:border-[var(--border-strong)] hover:text-white"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </button>
  );

  // The rail shows only the current org's projects; switching orgs is in the menu.
  const currentProjects = activeOrg
    ? list.filter((w) => w.organizationId === activeOrg.id)
    : list;

  function switchOrg(id: string) {
    setActiveOrgId(id);
    setMenuOpen(false);
    router.push(`/dashboard`);
  }

  return (
    <aside className="sticky top-0 z-30 flex h-screen w-16 shrink-0 flex-col items-center gap-1.5 border-r border-[var(--border)] bg-[var(--background)]/95 py-3 backdrop-blur">
      {/* Logo */}
      <Link
        href="/dashboard"
        title="Cortex — all projects"
        aria-label="Cortex home"
        className="mb-1 flex h-10 w-10 items-center justify-center"
      >
        <span className="inline-block h-5 w-5 rotate-45 rounded-sm bg-gradient-to-br from-[var(--accent)] via-[#b5179e] to-[var(--signal)] shadow-[0_0_14px_rgba(255,180,84,0.45)]" />
      </Link>
      <div className="h-px w-7 bg-[var(--border)]" />

      {/* The current organization's projects. Switching orgs happens in the
          user menu at the bottom. */}
      <nav className="flex min-h-0 flex-1 flex-col items-center gap-2 overflow-y-auto py-2">
        {currentProjects.map(renderProject)}
        {newProjectButton}
      </nav>

      <Modal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        title="New project"
        description={
          activeOrg
            ? `Added to ${activeOrg.name}. Switch organizations from the sidebar.`
            : "Create a project for your team, or join one with its code."
        }
      >
        <ProjectForms
          org={activeOrg}
          onDone={(id) => {
            setNewOpen(false);
            if (id) {
              setActiveId(id);
              router.push(`/projects/${id}`);
            }
          }}
        />
      </Modal>

      <Modal
        open={newOrgOpen}
        onClose={() => setNewOrgOpen(false)}
        title="Organizations"
        description="Create a new organization or join one with a code."
      >
        <OrgForms
          onDone={(id) => {
            setNewOrgOpen(false);
            if (id) router.push("/dashboard");
          }}
        />
      </Modal>

      {/* Bottom: the user avatar opens a menu — account, new org, docs, log out. */}
      <div className="relative flex flex-col items-center gap-1.5">
        <div className="my-1 h-px w-7 bg-[var(--border)]" />
        <button
          onClick={() => setMenuOpen((v) => !v)}
          title="Account & menu"
          aria-label="Account menu"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-xl border transition",
            menuOpen
              ? "border-[var(--border-strong)] bg-[var(--surface-2)]"
              : "border-transparent hover:bg-white/5",
          )}
        >
          {me?.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={me.avatarUrl} alt="" className="h-7 w-7 rounded-full ring-1 ring-[var(--border)]" />
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.6" />
              <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          )}
        </button>

        {menuOpen ? (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} aria-hidden />
            <div
              role="menu"
              className="absolute bottom-0 left-full z-50 ml-3 w-52 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface-1)] py-1 shadow-xl"
            >
              <div className="truncate px-3 py-2 text-xs text-[var(--faint)]">
                {me?.name ?? me?.email ?? "Account"}
              </div>
              <div className="h-px bg-[var(--border)]" />
              <div className="px-3 pb-1 pt-2 text-[10px] uppercase tracking-wide text-[var(--faint)]">
                Organizations
              </div>
              <div className="max-h-52 overflow-y-auto">
                {(orgs ?? []).map((o) => {
                  const on = activeOrg?.id === o.id;
                  return (
                    <button
                      key={o.id}
                      role="menuitem"
                      onClick={() => switchOrg(o.id)}
                      className={cn(
                        "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition hover:bg-white/5",
                        on ? "text-white" : "text-[var(--muted)] hover:text-white",
                      )}
                    >
                      <span className="truncate">{o.name}</span>
                      {on ? (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
                          <path d="M5 12l4 4 10-10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </button>
                  );
                })}
              </div>
              <button
                role="menuitem"
                onClick={() => {
                  setMenuOpen(false);
                  setNewOrgOpen(true);
                }}
                className="block w-full px-3 py-2 text-left text-sm text-[var(--accent)] transition hover:bg-white/5"
              >
                + New organization
              </button>
              <div className="h-px bg-[var(--border)]" />
              <MenuLink href="/account" onClick={() => setMenuOpen(false)}>
                Account
              </MenuLink>
              <MenuLink href="/docs" onClick={() => setMenuOpen(false)}>
                Documentation
              </MenuLink>
              {admin?.isSuperAdmin ? (
                <MenuLink href="/admin" onClick={() => setMenuOpen(false)}>
                  Admin
                </MenuLink>
              ) : null}
              <div className="h-px bg-[var(--border)]" />
              <button
                role="menuitem"
                onClick={logout}
                className="block w-full px-3 py-2 text-left text-sm text-[var(--muted)] transition hover:bg-white/5 hover:text-white"
              >
                Log out
              </button>
            </div>
          </>
        ) : null}
      </div>
    </aside>
  );
}
