"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type GeneratedDoc } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { Markdown } from "../../../../components/Markdown";
import { Button, Card } from "../../../../components/ui";

export default function DocsPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <Docs repoId={repoId} />
    </AppShell>
  );
}

function Docs({ repoId }: { repoId: string }) {
  const qc = useQueryClient();
  const { data: docs, isLoading } = useQuery({
    queryKey: ["docs", repoId],
    queryFn: () => api<GeneratedDoc[]>(`/repos/${repoId}/docs`),
  });
  const [selected, setSelected] = useState<string | null>(null);

  const generate = useMutation({
    mutationFn: () => api(`/repos/${repoId}/docs/generate`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["docs", repoId] }),
  });

  const active = docs?.find((d) => d.id === selected) ?? docs?.[0] ?? null;

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Living docs</h1>
          <p className="text-sm text-[var(--muted)]">
            Generated from this repo&apos;s approved memories.
          </p>
        </div>
        <Button onClick={() => generate.mutate()} disabled={generate.isPending}>
          {generate.isPending ? "Generating…" : docs?.length ? "Regenerate" : "Generate docs"}
        </Button>
      </div>

      {generate.isError ? (
        <p className="mt-3 text-sm text-red-400">{(generate.error as Error).message}</p>
      ) : null}

      {isLoading ? (
        <p className="mt-6 text-[var(--muted)]">Loading…</p>
      ) : !docs || docs.length === 0 ? (
        <Card className="mt-6 p-8 text-center text-[var(--muted)]">
          No docs yet. Approve some memories, then generate living docs from them.
        </Card>
      ) : (
        <div className="mt-6 grid gap-4 lg:grid-cols-[200px_1fr]">
          <div className="flex gap-2 lg:flex-col">
            {docs.map((d) => (
              <button
                key={d.id}
                onClick={() => setSelected(d.id)}
                className={`rounded-lg border px-3 py-2 text-left text-sm transition ${
                  active?.id === d.id
                    ? "border-[var(--accent)] bg-white/5"
                    : "border-[var(--border)] hover:bg-white/5"
                }`}
              >
                {d.title}
              </button>
            ))}
          </div>
          {active ? (
            <Card className="p-6">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="font-semibold">{active.title}</h2>
                <span className="text-xs text-[var(--muted)]">
                  updated {new Date(active.updatedAt).toLocaleString()}
                </span>
              </div>
              <Markdown>{active.content}</Markdown>
            </Card>
          ) : null}
        </div>
      )}
    </div>
  );
}
