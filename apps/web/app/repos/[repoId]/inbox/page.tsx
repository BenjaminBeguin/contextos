"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MEMORY_TYPES } from "@cortex/shared";
import { api, type Memory } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { MemoryCard } from "../../../../components/MemoryCard";
import { Button, Card } from "../../../../components/ui";

export default function InboxPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <Inbox repoId={repoId} />
    </AppShell>
  );
}

function Inbox({ repoId }: { repoId: string }) {
  const qc = useQueryClient();
  const { data: memories, isLoading } = useQuery({
    queryKey: ["memories", repoId, "proposed"],
    queryFn: () => api<Memory[]>(`/repos/${repoId}/memories?status=proposed`),
  });

  const [type, setType] = useState<string>("project_rule");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  const create = useMutation({
    mutationFn: () =>
      api<Memory>(`/repos/${repoId}/memories`, {
        method: "POST",
        body: JSON.stringify({ type, title, content, status: "proposed", source: "manual" }),
      }),
    onSuccess: () => {
      setTitle("");
      setContent("");
      qc.invalidateQueries({ queryKey: ["memories", repoId] });
    },
  });

  return (
    <div>
      <h1 className="text-2xl font-semibold">Memory inbox</h1>
      <p className="text-sm text-[var(--muted)]">
        Proposed memories awaiting review. Approve to expose them to Claude Code.
      </p>

      <Card className="mt-6 p-6">
        <h2 className="font-semibold">Propose a memory</h2>
        <div className="mt-4 space-y-3">
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="flex-1 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
            />
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What should agents remember?"
            rows={3}
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <Button onClick={() => create.mutate()} disabled={!title || !content || create.isPending}>
            {create.isPending ? "Adding…" : "Add to inbox"}
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {isLoading ? <p className="text-[var(--muted)]">Loading…</p> : null}
        {memories?.length === 0 ? (
          <p className="text-[var(--muted)]">Inbox is empty. Nothing to review.</p>
        ) : null}
        {memories?.map((m) => <MemoryCard key={m.id} memory={m} />)}
      </div>
    </div>
  );
}
