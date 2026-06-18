"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { MEMORY_STATUSES, MEMORY_TYPES } from "@cortex/shared";
import { api, isStaleMemory, type Me, type WorkspaceMemory } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { useActiveWorkspace } from "../../lib/workspace";
import {
  Badge,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select as UISelect,
  Spinner,
  StatusBadge,
} from "../../components/ui";

export default function SearchPage() {
  return (
    <AppShell>
      <Search />
    </AppShell>
  );
}

function Search() {
  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me") });
  const { activeId: activeWs } = useActiveWorkspace();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");

  const params = new URLSearchParams();
  if (q) params.set("search", q);
  if (status) params.set("status", status);
  if (type) params.set("type", type);

  const { data: results, isLoading } = useQuery({
    queryKey: ["ws-memories", activeWs, q, status, type],
    queryFn: () =>
      api<WorkspaceMemory[]>(`/workspaces/${activeWs}/memories?${params.toString()}`),
    enabled: !!activeWs,
  });

  if (me && me.workspaces.length === 0) {
    return (
      <p className="text-[var(--muted)]">
        No workspace yet.{" "}
        <Link href="/dashboard" className="text-[var(--accent)]">
          Create one →
        </Link>
      </p>
    );
  }

  return (
    <div>
      <PageHeader
        title="Search memory"
        description="Across every repo in the workspace."
      />

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
        {results?.map((m) => (
          <Card key={m.id} className="p-4">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <Badge label={m.type} />
              <StatusBadge status={m.status} />
              {isStaleMemory(m) ? (
                <span className="rounded-full border border-yellow-500/30 bg-yellow-500/15 px-2 py-0.5 text-xs text-yellow-300">
                  stale
                </span>
              ) : null}
              <Link
                href={`/repos/${m.repoId}/memories`}
                className="text-xs text-[var(--accent)] hover:underline"
              >
                {m.repoFullName}
              </Link>
            </div>
            <h3 className="font-semibold">{m.title}</h3>
            <p className="mt-1 line-clamp-3 text-sm text-[var(--muted)]">{m.content}</p>
          </Card>
        ))}
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
