"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type RepoSummary } from "../../lib/api";
import { AppShell } from "../../components/AppShell";
import { CopyButton } from "../../components/CopyButton";
import { Button, Card, Code } from "../../components/ui";

const PKG = "@mxbenjaminbeguin/cortex";
const MCP_JSON = JSON.stringify(
  { mcpServers: { cortex: { type: "stdio", command: "cortex", args: ["mcp"] } } },
  null,
  2,
);

export default function SetupPage() {
  return (
    <AppShell>
      <Setup />
    </AppShell>
  );
}

function Setup() {
  const { data: repos } = useQuery({ queryKey: ["repos"], queryFn: () => api<RepoSummary[]>("/repos") });
  const [repoId, setRepoId] = useState<string>("");
  const selected = repoId || repos?.[0]?.id || "";
  const initCmd = selected ? `cortex init --repo ${selected}` : "cortex init";

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Setup</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Install the Cortex CLI and connect Claude Code so it retrieves your team&apos;s approved
        memory automatically — before it acts.
      </p>

      <Step n={1} title="Install the CLI">
        <CommandBlock command={`npm install -g ${PKG}`} />
        <p className="mt-2 text-xs text-[var(--muted)]">
          Published as <code>{PKG}</code>; the installed command is <code>cortex</code>. Requires
          Node 20+.
        </p>
      </Step>

      <Step n={2} title="Authenticate">
        <CommandBlock command="cortex login" />
        <p className="mt-2 text-sm text-[var(--muted)]">
          Stores an API token in <code>~/.cortex/credentials.json</code>. Or generate one to set
          manually:
        </p>
        <TokenGenerator />
      </Step>

      <Step n={3} title="Connect a repository">
        {repos && repos.length > 0 ? (
          <>
            <label className="mb-2 block text-xs text-[var(--muted)]">Pick a repo</label>
            <select
              value={selected}
              onChange={(e) => setRepoId(e.target.value)}
              className="mb-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-sm"
            >
              {repos.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.fullName}
                </option>
              ))}
            </select>
            <CommandBlock command={initCmd} />
            <p className="mt-3 text-sm text-[var(--muted)]">
              Run from the repo root. Generates <code>.cortex/config.json</code>,{" "}
              <code>CLAUDE.md</code>, <code>.mcp.json</code>, and <code>.claude/hooks/*</code>.
            </p>
          </>
        ) : (
          <Card className="p-5 text-sm text-[var(--muted)]">
            No repos yet.{" "}
            <Link href="/dashboard" className="text-[var(--accent)]">
              Add one on the dashboard
            </Link>{" "}
            first, then come back for the exact connect command.
          </Card>
        )}
      </Step>

      <Step n={4} title="Use it in Claude Code">
        <p className="text-sm text-[var(--muted)]">
          Open Claude Code in the repo. It discovers the <code>cortex</code> MCP server and can
          call:
        </p>
        <div className="mt-3 space-y-2">
          <Tool name="get_repo_context()" desc="stack, recommended commands, risk warnings" />
          <Tool name="search_memory(query)" desc="approved memories relevant to the task" />
          <Tool
            name="record_session_summary(...)"
            desc="submit what it did → proposes new memories for review"
          />
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Only <strong>approved</strong> memories reach agents. Review proposals in each repo&apos;s
          inbox.
        </p>
      </Step>

      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Generated .mcp.json</h2>
          <CopyButton value={MCP_JSON} />
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Written by <code>cortex init</code>. If Claude Code can&apos;t launch the server, make
          sure <code>cortex</code> is on your PATH.
        </p>
        <div className="mt-3">
          <Code>{MCP_JSON}</Code>
        </div>
      </Card>
    </div>
  );
}

function CommandBlock({ command }: { command: string }) {
  return (
    <div className="relative">
      <Code>{command}</Code>
      <div className="absolute right-2 top-2">
        <CopyButton value={command} />
      </div>
    </div>
  );
}

function TokenGenerator() {
  const [token, setToken] = useState<string | null>(null);
  const gen = useMutation({
    mutationFn: () => api<{ token: string }>("/auth/tokens", { method: "POST", body: "{}" }),
    onSuccess: (d) => setToken(d.token),
  });

  if (token) {
    return (
      <div className="mt-3">
        <div className="mb-1 flex items-center justify-between">
          <p className="text-xs text-yellow-300">Copy it now — it won&apos;t be shown again.</p>
          <CopyButton value={token} />
        </div>
        <Code>{token}</Code>
      </div>
    );
  }
  return (
    <div className="mt-3">
      <Button variant="ghost" onClick={() => gen.mutate()} disabled={gen.isPending}>
        {gen.isPending ? "Generating…" : "Generate API token"}
      </Button>
    </div>
  );
}

function Tool({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex items-baseline gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2">
      <code className="text-sm text-cyan-200">{name}</code>
      <span className="text-xs text-[var(--muted)]">{desc}</span>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--accent)] text-xs font-semibold text-white">
          {n}
        </span>
        <h2 className="font-semibold">{title}</h2>
      </div>
      {children}
    </div>
  );
}
