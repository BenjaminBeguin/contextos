"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { Button, Code, Spinner, Textarea } from "./ui";

interface RepoDetail {
  id: string;
  fullName: string;
  reviewerEnabled?: boolean;
  reviewerInstructions?: string | null;
  memoryCounts?: { status: string; _count: number }[];
}

/** A right-side drawer to set up / configure a single repo, opened from project Setup. */
export function RepoSetupDrawer({ repoId, onClose }: { repoId: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data: repo, isLoading } = useQuery({
    queryKey: ["repo", repoId],
    queryFn: () => api<RepoDetail>(`/repos/${repoId}`),
  });

  const [enabled, setEnabled] = useState(false);
  const [instructions, setInstructions] = useState("");
  useEffect(() => {
    if (repo) {
      setEnabled(!!repo.reviewerEnabled);
      setInstructions(repo.reviewerInstructions ?? "");
    }
  }, [repo]);

  const save = useMutation({
    mutationFn: () =>
      api(`/repos/${repoId}`, {
        method: "PATCH",
        body: JSON.stringify({ reviewerEnabled: enabled, reviewerInstructions: instructions.trim() }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repo", repoId] }),
  });

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm ctx-fade-in" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-md flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl [animation:ctx-slide-in_0.22s_ease-out]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs text-[var(--muted)]">Set up repo</p>
            <h2 className="truncate font-display text-lg font-semibold">
              {repo?.fullName ?? "…"}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-white/5 hover:text-white"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {isLoading || !repo ? (
          <div className="flex flex-1 items-center justify-center text-[var(--muted)]">
            <Spinner /> <span className="ml-2 text-sm">Loading…</span>
          </div>
        ) : (
          <div className="space-y-6 p-5">
            <section>
              <h3 className="mb-2 text-sm font-semibold">Connect Claude Code</h3>
              <p className="mb-3 text-xs text-[var(--muted)]">
                Run from your local checkout — writes CLAUDE.md, .mcp.json, and hooks.
              </p>
              <Code label={repo.fullName}>{`cortex init --repo ${repo.id}`}</Code>
            </section>

            <section>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">PR Reviewer</h3>
                <label className="flex items-center gap-2 text-xs text-[var(--muted)]">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={(e) => setEnabled(e.target.checked)}
                    className="h-4 w-4 accent-[var(--accent)]"
                  />
                  Enable in CI
                </label>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                Memory-grounded reviews on every PR. Add repo-specific guidance below.
              </p>
              <Textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={2}
                placeholder="e.g. Be strict about DB migrations and anything under src/billing/**."
                className="mt-2"
              />
              <div className="mt-2 flex items-center gap-2">
                <Button size="sm" onClick={() => save.mutate()} loading={save.isPending}>
                  Save
                </Button>
                {save.isSuccess ? <span className="text-xs text-[var(--verify)]">Saved.</span> : null}
              </div>
            </section>

            <Link
              href={`/repos/${repoId}`}
              className="inline-block text-xs text-[var(--accent)] hover:underline"
            >
              Open full repo settings →
            </Link>
          </div>
        )}
      </aside>
    </div>
  );
}
