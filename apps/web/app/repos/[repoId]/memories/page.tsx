"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MEMORY_STATUSES, MEMORY_TYPES } from "@cortex/shared";
import { api, isStaleMemory, type Memory, type MemoryHealthReport } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { MemoryCard } from "../../../../components/MemoryCard";
import { usePagination, Pagination } from "../../../../components/Pagination";

export default function MemoriesPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <Library repoId={repoId} />
    </AppShell>
  );
}

function Library({ repoId }: { repoId: string }) {
  const [status, setStatus] = useState<string>("");
  const [type, setType] = useState<string>("");
  const [search, setSearch] = useState("");
  const [staleOnly, setStaleOnly] = useState(false);

  const query = new URLSearchParams();
  if (status) query.set("status", status);
  if (type) query.set("type", type);
  if (search) query.set("search", search);

  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories", repoId, status, type, search],
    queryFn: () => api<Memory[]>(`/repos/${repoId}/memories?${query.toString()}`),
  });

  const staleCount = (memories ?? []).filter(isStaleMemory).length;
  const shown = staleOnly ? (memories ?? []).filter(isStaleMemory) : (memories ?? []);
  const { pageItems, page, setPage, totalPages, total } = usePagination(shown);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Memory library</h1>
      <MemoryHealthPanel repoId={repoId} />
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search…"
          className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
        />
        <Select value={status} onChange={setStatus} placeholder="All statuses" options={[...MEMORY_STATUSES]} />
        <Select value={type} onChange={setType} placeholder="All types" options={[...MEMORY_TYPES]} />
        <label className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={staleOnly}
            onChange={(e) => setStaleOnly(e.target.checked)}
          />
          Stale only {staleCount > 0 ? <span className="text-yellow-300">({staleCount})</span> : null}
        </label>
      </div>

      <div className="mt-6 space-y-4">
        {isLoading ? <p className="text-[var(--muted)]">Loading…</p> : null}
        {shown.length === 0 ? (
          <p className="text-[var(--muted)]">No memories match these filters.</p>
        ) : null}
        {pageItems.map((m) => (
          <MemoryCard key={m.id} memory={m} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} label="memories" />
    </div>
  );
}

/**
 * Corpus health for this repo: how much approved memory is aging out, and pairs
 * that duplicate or contradict each other. Renders only when there's something
 * to act on, so a healthy library stays quiet.
 */
function MemoryHealthPanel({ repoId }: { repoId: string }) {
  const { data } = useQuery({
    queryKey: ["memory-health", repoId],
    queryFn: () => api<MemoryHealthReport>(`/repos/${repoId}/memory-health`),
  });
  if (!data) return null;
  const needsAttention = data.aging > 0 || data.stale > 0 || data.conflicts.length > 0;
  if (!needsAttention) return null;

  return (
    <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
        <span className="font-medium">Memory health</span>
        <span className="text-[var(--muted)]">{data.approvedCount} approved</span>
        {data.aging > 0 ? <span className="text-yellow-300/90">{data.aging} aging</span> : null}
        {data.stale > 0 ? <span className="text-orange-300">{data.stale} stale</span> : null}
        {data.conflicts.length > 0 ? (
          <span className="text-red-300">{data.conflicts.length} to reconcile</span>
        ) : null}
      </div>

      {data.conflicts.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {data.conflicts.map((c) => (
            <li
              key={`${c.a.id}-${c.b.id}`}
              className="flex flex-wrap items-center gap-2 text-sm text-[var(--muted)]"
            >
              <span
                className={`rounded px-1.5 py-0.5 text-xs font-medium ${
                  c.kind === "duplicate"
                    ? "bg-blue-500/15 text-blue-300"
                    : "bg-red-500/15 text-red-300"
                }`}
              >
                {c.kind}
              </span>
              <span className="text-[var(--fg)]">{c.a.title}</span>
              <span>↔</span>
              <span className="text-[var(--fg)]">{c.b.title}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}
