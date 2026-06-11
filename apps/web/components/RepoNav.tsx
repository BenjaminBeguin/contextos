"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function RepoNav({ repoId }: { repoId: string }) {
  const pathname = usePathname();
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
    <nav className="mb-6 flex gap-1 border-b border-[var(--border)]">
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
  );
}
