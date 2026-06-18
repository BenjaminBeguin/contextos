"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";
import { setActiveWorkspaceId } from "../lib/workspace";

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

  const tabs = [
    { href: `/repos/${repoId}`, label: "Overview" },
    { href: `/repos/${repoId}/memories`, label: "Memory library" },
    { href: `/repos/${repoId}/inbox`, label: "Inbox" },
    { href: `/repos/${repoId}/risks`, label: "Risks" },
    { href: `/repos/${repoId}/sessions`, label: "Sessions" },
    { href: `/repos/${repoId}/docs`, label: "Docs" },
    { href: `/repos/${repoId}/setup`, label: "Claude Code setup" },
  ];
  return (
    <div className="mb-6">
      <div className="mb-3 flex items-center gap-2 text-sm">
        <Link href="/dashboard" className="text-[var(--muted)] hover:text-white">
          {repo?.workspace?.name ?? "Workspace"}
        </Link>
        <span className="text-[var(--muted)]">/</span>
        <span className="font-medium text-white">{repo?.fullName ?? repoId}</span>
      </div>
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
