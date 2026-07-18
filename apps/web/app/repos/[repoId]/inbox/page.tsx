"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MEMORY_TYPES } from "@memmo/shared";
import { api, type Memory } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { MemoryCard } from "../../../../components/MemoryCard";
import { usePagination, Pagination } from "../../../../components/Pagination";
import { Button, Card, EmptyState, Input, PageHeader, Select, Spinner, Textarea } from "../../../../components/ui";

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
  const { pageItems, page, setPage, totalPages, total } = usePagination(memories ?? []);

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
      <PageHeader
        title="Memory inbox"
        description="Proposed memories awaiting review. Approve to expose them to Claude Code."
      />

      <Card className="p-6">
        <h2 className="font-semibold">Propose a memory</h2>
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={type} onChange={(e) => setType(e.target.value)}>
              {MEMORY_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Title"
              className="min-w-48 flex-1"
            />
          </div>
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="What should agents remember?"
            rows={3}
          />
          <Button onClick={() => create.mutate()} disabled={!title || !content} loading={create.isPending}>
            {create.isPending ? "Adding…" : "Add to inbox"}
          </Button>
        </div>
      </Card>

      <div className="mt-6 space-y-4">
        {isLoading ? (
          <p className="flex items-center gap-2 text-[var(--muted)]">
            <Spinner /> Loading…
          </p>
        ) : null}
        {memories?.length === 0 ? (
          <EmptyState
            title="Inbox is empty"
            description="Nothing to review. New proposals from scans and Claude Code sessions show up here."
          />
        ) : null}
        {pageItems.map((m) => (
          <MemoryCard key={m.id} memory={m} />
        ))}
        <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} label="proposals" />
      </div>
    </div>
  );
}
