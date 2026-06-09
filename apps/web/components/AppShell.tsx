"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../lib/api";
import { Button } from "./ui";

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: me, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/me"),
    retry: false,
  });

  async function logout() {
    await api("/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
              <span className="inline-block h-4 w-4 rounded-sm bg-[var(--accent)]" />
              ContextOS
            </Link>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            {me ? <span>{me.email}</span> : null}
            <Button variant="ghost" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        {isLoading ? (
          <p className="text-[var(--muted)]">Loading…</p>
        ) : isError || !me ? (
          <div className="text-[var(--muted)]">
            <p>You are not signed in.</p>
            <Link href="/login" className="text-[var(--accent)]">
              Go to login →
            </Link>
          </div>
        ) : (
          children
        )}
      </main>
    </div>
  );
}
