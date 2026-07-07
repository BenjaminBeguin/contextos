"use client";

import { useEffect } from "react";
import { RepoSettings } from "./RepoSettings";

/** A right-side drawer with a repo's full settings, opened from project Setup. */
export function RepoSetupDrawer({
  repoId,
  fullName,
  onClose,
}: {
  repoId: string;
  fullName?: string;
  onClose: () => void;
}) {
  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm ctx-fade-in" onClick={onClose} />
      <aside className="relative flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-[var(--border)] bg-[var(--surface)] shadow-2xl [animation:ctx-slide-in_0.22s_ease-out]">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-[var(--border)] bg-[var(--surface)]/95 px-5 py-4 backdrop-blur">
          <div className="min-w-0">
            <p className="text-xs text-[var(--muted)]">Repo settings</p>
            <h2 className="truncate font-display text-lg font-semibold">{fullName ?? "Repo"}</h2>
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

        <div className="p-5">
          <RepoSettings repoId={repoId} onDeleted={onClose} />
        </div>
      </aside>
    </div>
  );
}
