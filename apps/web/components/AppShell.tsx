"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { api, type Me } from "../lib/api";
import { WorkspaceRail } from "./WorkspaceRail";

/** The Memmo diamond mark, matching the workspace rail + login. */
function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-block rotate-45 rounded-[6px] bg-gradient-to-br from-[var(--accent)] via-[#b5179e] to-[var(--signal)] shadow-[0_0_22px_rgba(255,180,84,0.45)]"
      style={{ height: size, width: size }}
      aria-hidden
    />
  );
}

/** Full-height centered panel used for the loading + signed-out states (no rail). */
function CenterStage({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-6">
      {/* soft brand glow behind the panel */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[420px]"
        style={{
          background:
            "radial-gradient(50% 60% at 50% 0%, var(--accent-soft), transparent 70%), radial-gradient(40% 50% at 70% 10%, var(--signal-soft), transparent 70%)",
        }}
        aria-hidden
      />
      <div className="ctx-fade-in relative">{children}</div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading, isError } = useQuery({
    queryKey: ["me"],
    queryFn: () => api<Me>("/me"),
    retry: false,
  });

  // While we resolve the session, hold a calm branded stage instead of a bare
  // "Loading…" that flashes then reflows into the app chrome.
  if (isLoading) {
    return (
      <CenterStage>
        <div className="flex flex-col items-center gap-4 text-[var(--muted)]">
          <span className="animate-pulse">
            <BrandMark size={30} />
          </span>
          <span className="text-sm">Loading your workspace…</span>
        </div>
      </CenterStage>
    );
  }

  // Signed out: a real welcome gate, not the app shell wrapped around an empty void.
  if (isError || !me) {
    return (
      <CenterStage>
        <div className="w-full max-w-sm text-center">
          <div className="mb-6 flex justify-center">
            <BrandMark size={34} />
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">Welcome to Memmo</h1>
          <p className="mx-auto mt-2 max-w-xs text-sm text-[var(--muted)]">
            Operational memory for your AI coding agents. Sign in to manage your team&apos;s memory
            and reviews.
          </p>
          <Link
            href="/login"
            className="brand-gradient mt-7 inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 active:scale-[0.99]"
          >
            Sign in
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M5 12h14m0 0-5-5m5 5-5 5"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
          <p className="mt-4 text-xs text-[var(--faint)]">
            New here?{" "}
            <a href="/" className="text-[var(--muted)] underline-offset-2 hover:underline">
              Learn what Memmo does
            </a>
          </p>
        </div>
      </CenterStage>
    );
  }

  return (
    <div className="flex min-h-screen">
      <WorkspaceRail />
      <main className="min-w-0 flex-1">
        <div className="ctx-fade-in px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
