"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { setActiveWorkspaceId } from "../lib/workspace";
import { projectColor } from "../lib/projectColor";
import { Breadcrumb } from "./ui";

interface RepoHeader {
  fullName?: string;
  workspaceId?: string;
  workspace?: { name: string; slug: string } | null;
}

export function RepoNav({ repoId }: { repoId: string }) {
  const pathname = usePathname();
  const { data: repo } = useQuery({
    queryKey: ["repo", repoId],
    queryFn: () => api<RepoHeader>(`/repos/${repoId}`),
  });

  // Keep the global workspace indicator in sync with the repo you're viewing.
  useEffect(() => {
    if (repo?.workspaceId) setActiveWorkspaceId(repo.workspaceId);
  }, [repo?.workspaceId]);

  // Kept intentionally lean — a repo just shows its own artifacts. Inbox, risk
  // creation, sessions, and Claude Code setup live at the project (top) level.
  const tabs = [
    { href: `/repos/${repoId}`, label: "Overview" },
    { href: `/repos/${repoId}/memories`, label: "Memory library" },
    { href: `/repos/${repoId}/reviews`, label: "Reviews" },
    { href: `/repos/${repoId}/docs`, label: "Docs" },
  ];
  return (
    <div className="mb-6">
      <Breadcrumb
        items={[
          { label: "Projects", href: "/dashboard" },
          {
            label: repo?.workspace?.name ?? "Project",
            href: repo?.workspaceId ? `/projects/${repo.workspaceId}` : "/dashboard",
            color: projectColor(repo?.workspaceId).color,
          },
          { label: repo?.fullName ?? repoId },
        ]}
      />
      <nav className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map((t) => {
          const active = pathname === t.href;
          return (
            <Link
              key={t.href}
              href={t.href}
              className={`-mb-px border-b-2 px-3 py-2 text-sm ${
                active
                  ? "border-[var(--accent)] text-white"
                  : "border-transparent text-[var(--muted)] hover:text-white"
              }`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
