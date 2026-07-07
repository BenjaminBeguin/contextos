"use client";

import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, API_BASE_URL, type GithubRepo, type RepoSummary } from "../lib/api";
import { Button } from "./ui";

export function RepoPicker({
  workspaceId,
  onCreated,
  existingFullNames = [],
}: {
  workspaceId: string;
  onCreated: () => void;
  /** Repos already linked to this project — hidden from the pick list. */
  existingFullNames?: string[];
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [manual, setManual] = useState(false);
  const [manualName, setManualName] = useState("");

  const reposQuery = useQuery({
    queryKey: ["github-repos"],
    queryFn: () => api<GithubRepo[]>("/github/repos"),
    retry: false,
  });

  const notConnected =
    reposQuery.isError && (reposQuery.error as Error).message === "github_not_connected";

  const create = useMutation({
    mutationFn: (input: { name: string; fullName: string; defaultBranch?: string }) =>
      api<RepoSummary>("/repos", {
        method: "POST",
        body: JSON.stringify({ ...input, workspaceId, provider: "github" }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repos"] });
      onCreated();
    },
  });

  const filtered = useMemo(() => {
    const already = new Set(existingFullNames.map((n) => n.toLowerCase()));
    const list = (reposQuery.data ?? []).filter((r) => !already.has(r.fullName.toLowerCase()));
    const q = search.trim().toLowerCase();
    return q ? list.filter((r) => r.fullName.toLowerCase().includes(q)) : list;
  }, [reposQuery.data, search, existingFullNames]);

  if (notConnected) {
    return (
      <div className="text-sm text-[var(--muted)]">
        <p>Connect your GitHub account to list your repositories.</p>
        <a
          href={`${API_BASE_URL}/auth/github/login`}
          className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 font-semibold text-black"
        >
          Connect GitHub
        </a>
        <button
          onClick={() => setManual(true)}
          className="ml-3 text-[var(--accent)] hover:underline"
        >
          or enter manually
        </button>
        {manual ? <ManualEntry value={manualName} onChange={setManualName} onSubmit={() => create.mutate({ name: manualName, fullName: manualName })} pending={create.isPending} /> : null}
      </div>
    );
  }

  if (manual) {
    return (
      <div>
        <ManualEntry
          value={manualName}
          onChange={setManualName}
          onSubmit={() => create.mutate({ name: manualName, fullName: manualName })}
          pending={create.isPending}
        />
        <button onClick={() => setManual(false)} className="mt-3 text-sm text-[var(--accent)] hover:underline">
          ← back to GitHub repos
        </button>
        {create.isError ? (
          <p className="mt-2 text-sm text-red-400">{(create.error as Error).message}</p>
        ) : null}
      </div>
    );
  }

  return (
    <div>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search your repositories…"
        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <div className="mt-3 max-h-72 overflow-y-auto rounded-lg border border-[var(--border)]">
        {reposQuery.isLoading ? (
          <p className="p-4 text-sm text-[var(--muted)]">Loading your repositories…</p>
        ) : filtered.length === 0 ? (
          <p className="p-4 text-sm text-[var(--muted)]">No repositories match.</p>
        ) : (
          filtered.map((r) => (
            <button
              key={r.fullName}
              disabled={create.isPending}
              onClick={() =>
                create.mutate({ name: r.name, fullName: r.fullName, defaultBranch: r.defaultBranch })
              }
              className="flex w-full items-center justify-between border-b border-[var(--border)] px-4 py-2.5 text-left text-sm last:border-0 hover:bg-white/5 disabled:opacity-50"
            >
              <span className="flex items-center gap-2">
                <span>{r.fullName}</span>
                {r.private ? (
                  <span className="rounded border border-[var(--border)] px-1 text-[10px] text-[var(--muted)]">
                    private
                  </span>
                ) : null}
              </span>
              {r.language ? <span className="text-xs text-[var(--muted)]">{r.language}</span> : null}
            </button>
          ))
        )}
      </div>
      <div className="mt-3 flex items-center gap-3 text-sm">
        <button onClick={() => setManual(true)} className="text-[var(--accent)] hover:underline">
          Enter manually instead
        </button>
        {create.isError ? <span className="text-red-400">{(create.error as Error).message}</span> : null}
      </div>
    </div>
  );
}

function ManualEntry({
  value,
  onChange,
  onSubmit,
  pending,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="owner/repo"
        className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
      />
      <Button onClick={onSubmit} disabled={!value || pending}>
        {pending ? "Creating…" : "Create"}
      </Button>
    </div>
  );
}
