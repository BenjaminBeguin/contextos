"use client";

import { use, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MEMORY_STATUSES, MEMORY_TYPES } from "@cortex/shared";
import { api, isStaleMemory, type Memory } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { MemoryCard } from "../../../../components/MemoryCard";

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
  const shown = staleOnly ? (memories ?? []).filter(isStaleMemory) : memories;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Memory library</h1>
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
        {shown?.length === 0 ? (
          <p className="text-[var(--muted)]">No memories match these filters.</p>
        ) : null}
        {shown?.map((m) => <MemoryCard key={m.id} memory={m} />)}
      </div>
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
