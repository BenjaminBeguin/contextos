"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../lib/api";
import { Spinner } from "./ui";
import { WorkspaceRail } from "./WorkspaceRail";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/me"),
    retry: false,
  });

  return (
    <div className="flex min-h-screen">
      <WorkspaceRail />
      <main className="min-w-0 flex-1">
        <div className="px-8 py-8">
          {isLoading ? (
            <div className="flex items-center gap-2 text-[var(--muted)]">
              <Spinner /> Loading…
            </div>
          ) : isError || !me ? (
            <div className="text-[var(--muted)]">
              <p>You are not signed in.</p>
              <Link href="/login" className="text-[var(--accent)]">
                Go to login →
              </Link>
            </div>
          ) : (
            <div className="ctx-fade-in">{children}</div>
          )}
        </div>
      </main>
    </div>
  );
}
