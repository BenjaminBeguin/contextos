"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../lib/api";
import { Button, cn, Spinner } from "./ui";
import { WorkspaceSwitcher } from "./WorkspaceSwitcher";

const NAV = [
  { href: "/dashboard", label: "Projects", match: ["/dashboard", "/projects", "/repos", "/settings"] },
  { href: "/account", label: "Account", match: ["/account"] },
  { href: "/docs", label: "Documentation", match: ["/docs"] },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
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
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
          <div className="flex items-center gap-7">
            <Link href="/dashboard" className="flex items-center gap-2.5 font-semibold">
              <span className="inline-block h-4 w-4 rotate-45 rounded-sm bg-gradient-to-br from-violet-400 to-cyan-400 shadow-[0_0_14px_rgba(34,211,238,0.45)]" />
              Cortex
            </Link>
            <nav className="hidden items-center gap-1 text-sm md:flex">
              {NAV.map((item) => {
                const active = item.match.some((m) => pathname.startsWith(m));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "rounded-lg px-3 py-1.5 transition",
                      active
                        ? "bg-[var(--surface-2)] text-white"
                        : "text-[var(--muted)] hover:bg-white/5 hover:text-white",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3 text-sm text-[var(--muted)]">
            {me && me.workspaces.length > 0 ? <WorkspaceSwitcher /> : null}
            {me ? (
              <span className="hidden items-center gap-2 sm:flex">
                {me.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={me.avatarUrl} alt="" className="h-7 w-7 rounded-full ring-1 ring-[var(--border)]" />
                ) : null}
              </span>
            ) : null}
            <Button variant="ghost" size="sm" onClick={logout}>
              Log out
            </Button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="flex items-center gap-1 overflow-x-auto px-4 pb-2 text-sm md:hidden">
          {NAV.map((item) => {
            const active = item.match.some((m) => pathname.startsWith(m));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-lg px-3 py-1.5 transition",
                  active ? "bg-[var(--surface-2)] text-white" : "text-[var(--muted)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
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
      </main>
    </div>
  );
}
