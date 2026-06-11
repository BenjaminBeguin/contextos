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
              Cortex
            </Link>
            <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
              <Link href="/dashboard" className="hover:text-white">
                Dashboard
              </Link>
              <Link href="/graph" className="hover:text-white">
                Graph
              </Link>
              <Link href="/chat" className="hover:text-white">
                Chat
              </Link>
              <Link href="/usage" className="hover:text-white">
                Usage
              </Link>
              <Link href="/setup" className="hover:text-white">
                Setup
              </Link>
              <Link href="/settings" className="hover:text-white">
                Settings
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            {me ? (
              <span className="flex items-center gap-2">
                {me.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.avatarUrl} alt="" className="h-6 w-6 rounded-full" />
                ) : null}
                {me.email}
              </span>
            ) : null}
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
