"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MEMORY_STATUSES, MEMORY_TYPES } from "@memmo/shared";
import { api, isStaleMemory, type WorkspaceMemory } from "../../lib/api";
import { usePagination, Pagination } from "../Pagination";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  Select as UISelect,
  Spinner,
  StatusBadge,
} from "../ui";

/** Full-text search across every memory in a project (workspace). */
export function SearchTool({ workspaceId }: { workspaceId: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const params = new URLSearchParams();
  if (q) params.set("search", q);
  if (status) params.set("status", status);
  if (type) params.set("type", type);

  const { data: results, isLoading } = useQuery({
    queryKey: ["ws-memories", workspaceId, q, status, type],
    queryFn: () =>
      api<WorkspaceMemory[]>(`/workspaces/${workspaceId}/memories?${params.toString()}`),
    enabled: !!workspaceId,
  });
  const { pageItems, page, setPage, totalPages, total } = usePagination(results ?? []);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search titles and content…"
          className="min-w-64 flex-1"
        />
        <Select value={status} onChange={setStatus} placeholder="All statuses" options={[...MEMORY_STATUSES]} />
        <Select value={type} onChange={setType} placeholder="All types" options={[...MEMORY_TYPES]} />
      </div>

      <div className="mt-6 space-y-3">
        {isLoading ? (
          <p className="flex items-center gap-2 text-[var(--muted)]">
            <Spinner /> Searching…
          </p>
        ) : null}
        {results?.length === 0 ? (
          <EmptyState
            title="No memories match"
            description="Try a different search term, or clear the status and type filters."
          />
        ) : null}
        {pageItems.map((m) => (
          <ResultCard key={m.id} m={m} />
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} label="memories" />
    </div>
  );
}

/** A search hit whose content expands in place so long memories are fully readable. */
function ResultCard({ m }: { m: WorkspaceMemory }) {
  const [open, setOpen] = useState(false);
  // Only offer expand when there's meaningfully more than the 3-line clamp shows.
  const expandable = m.content.length > 180 || (m.paths?.length ?? 0) > 0 || !!m.evidence?.length;

  return (
    <Card className="p-4">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <Badge label={m.type} />
        <StatusBadge status={m.status} />
        {isStaleMemory(m) ? (
          <span className="rounded-full border border-yellow-500/30 bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-300">
            stale
          </span>
        ) : null}
        <span className="text-xs text-[var(--muted)]">conf {Math.round(m.confidence * 100)}%</span>
        <Link
          href={`/repos/${m.repoId}/memories`}
          className="text-xs text-[var(--accent)] hover:underline"
        >
          {m.repoFullName}
        </Link>
      </div>

      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className={`block w-full text-left ${expandable ? "cursor-pointer" : "cursor-default"}`}
        aria-expanded={open}
      >
        <h3 className="font-semibold">{m.title}</h3>
        <p className={`mt-1 whitespace-pre-wrap text-sm text-[var(--muted)] ${open ? "" : "line-clamp-3"}`}>
          {m.content}
        </p>
      </button>

      {open && m.paths?.length ? (
        <div className="mt-2 flex flex-wrap gap-1">
          {m.paths.map((p) => (
            <span
              key={p}
              className="rounded border border-[var(--border)] bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-[var(--accent-cyan)]"
            >
              {p}
            </span>
          ))}
        </div>
      ) : null}

      {open && m.evidence?.length ? (
        <div className="mt-3 border-l-2 border-[var(--border)] pl-3">
          {m.evidence.map((e) => (
            <p key={e.id} className="text-xs text-[var(--muted)]">
              <span className="text-white/70">{e.kind}:</span> {e.content}
            </p>
          ))}
        </div>
      ) : null}

      {expandable ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 inline-flex items-center gap-1 text-xs text-[var(--muted)] transition hover:text-white"
        >
          {open ? "Show less" : "Show more"}
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            className={`transition-transform ${open ? "rotate-180" : ""}`}
            aria-hidden
          >
            <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      ) : null}
    </Card>
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
    <UISelect value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </UISelect>
  );
}
