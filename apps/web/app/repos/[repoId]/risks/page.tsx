"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type Memory } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { Badge, Button, Card } from "../../../../components/ui";

interface Warning {
  type: string;
  title: string;
  content: string;
  paths: string[];
}

export default function RisksPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <Risks repoId={repoId} />
    </AppShell>
  );
}

function Risks({ repoId }: { repoId: string }) {
  const { data: memories } = useQuery({
    queryKey: ["memories", repoId, "approved"],
    queryFn: () => api<Memory[]>(`/repos/${repoId}/memories?status=approved`),
  });
  const risks = (memories ?? []).filter((m) => m.type === "risk" || m.type === "failure");

  const [files, setFiles] = useState("");
  const check = useMutation({
    mutationFn: () =>
      api<{ warnings: Warning[] }>("/mcp/get_relevant_warnings", {
        method: "POST",
        body: JSON.stringify({
          repoId,
          files: files
            .split(/[\n,]/)
            .map((f) => f.trim())
            .filter(Boolean),
        }),
      }),
  });

  const fileCount = files.split(/[\n,]/).map((f) => f.trim()).filter(Boolean).length;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Risks &amp; warnings</h1>
      <p className="text-sm text-[var(--muted)]">
        Risk and failure memories Claude Code surfaces before editing matching files (via{" "}
        <code>get_relevant_warnings</code>).
      </p>

      {/* Tester */}
      <Card className="mt-6 p-6">
        <h2 className="font-semibold">Test which warnings fire</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Paste file paths (one per line) to preview exactly what an agent would be warned about.
        </p>
        <textarea
          value={files}
          onChange={(e) => setFiles(e.target.value)}
          rows={4}
          placeholder={"src/billing/webhooks.ts\nsrc/auth/login.ts"}
          className="mt-3 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 font-mono text-sm outline-none focus:border-[var(--accent)]"
        />
        <div className="mt-3">
          <Button onClick={() => check.mutate()} disabled={fileCount === 0 || check.isPending}>
            {check.isPending ? "Checking…" : "Check warnings"}
          </Button>
        </div>

        {check.data ? (
          check.data.warnings.length === 0 ? (
            <p className="mt-4 text-sm text-emerald-300">
              ✓ No known risks for these files.
            </p>
          ) : (
            <div className="mt-4 space-y-3">
              {check.data.warnings.map((w, i) => (
                <div key={i} className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
                  <div className="mb-1 flex items-center gap-2">
                    <span>⚠</span>
                    <Badge label={w.type} />
                    <span className="font-semibold">{w.title}</span>
                  </div>
                  <p className="text-sm text-[var(--muted)]">{w.content}</p>
                </div>
              ))}
            </div>
          )
        ) : null}
        {check.isError ? (
          <p className="mt-3 text-sm text-red-400">{(check.error as Error).message}</p>
        ) : null}
      </Card>

      {/* Coverage list */}
      <div className="mt-8">
        <h2 className="font-semibold">Risk coverage</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {risks.length} approved risk/failure {risks.length === 1 ? "memory" : "memories"}. Add file
          globs to a memory (in the{" "}
          <Link href={`/repos/${repoId}/memories`} className="text-[var(--accent)]">
            library
          </Link>
          ) so warnings target the right files.
        </p>

        {risks.length === 0 ? (
          <Card className="mt-4 p-6 text-sm text-[var(--muted)]">
            No risk memories yet. Approve a <code>risk</code> or <code>failure</code> memory and tag
            it with the files it applies to.
          </Card>
        ) : (
          <div className="mt-4 space-y-3">
            {risks.map((m) => (
              <Card key={m.id} className="p-5">
                <div className="mb-1 flex items-center gap-2">
                  <Badge label={m.type} />
                  <span className="font-semibold">{m.title}</span>
                </div>
                <p className="text-sm text-[var(--muted)]">{m.content}</p>
                <div className="mt-3">
                  {m.paths && m.paths.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {m.paths.map((p) => (
                        <span
                          key={p}
                          className="rounded border border-[var(--border)] bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200"
                        >
                          {p}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-yellow-300/80">
                      No paths set — matches loosely by content. Add globs for precise warnings.
                    </span>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
