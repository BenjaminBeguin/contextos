"use client";

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useMutation } from "@tanstack/react-query";
import { api } from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { CopyButton } from "../../../../components/CopyButton";
import { Button, Card, Code } from "../../../../components/ui";

const PKG = "memmo";

const MCP_JSON = JSON.stringify(
  { mcpServers: { memmo: { type: "stdio", command: "memmo", args: ["mcp"] } } },
  null,
  2,
);

export default function SetupPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <Setup repoId={repoId} />
    </AppShell>
  );
}

function Setup({ repoId }: { repoId: string }) {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold">Set up this project</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Install the CLI, authenticate, and connect this repo. Claude Code will then retrieve your
        team&apos;s approved memory through the Memmo MCP server — automatically, before it acts.
      </p>

      <Step n={1} title="Install the CLI">
        <CommandBlock command={`npm install -g ${PKG}`} />
        <p className="mt-2 text-xs text-[var(--muted)]">
          The package is <code>{PKG}</code>; the installed command is <code>memmo</code>.
        </p>
      </Step>

      <Step n={2} title="Authenticate">
        <CommandBlock command="memmo login" />
        <p className="mt-2 text-sm text-[var(--muted)]">
          Stores an API token in <code>~/.memmo/credentials.json</code>. Prefer to set it
          manually? Generate one here:
        </p>
        <TokenGenerator />
      </Step>

      <Step n={3} title="Connect this repo">
        <CommandBlock command={`memmo init --repo ${repoId}`} />
        <p className="mt-3 text-sm text-[var(--muted)]">Run from the repo root. This generates:</p>
        <ul className="mt-2 space-y-1 text-sm text-[var(--muted)]">
          <li>
            <code>.memmo/config.json</code> — links this directory to the repo
          </li>
          <li>
            <code>CLAUDE.md</code> — guidance the agent reads
          </li>
          <li>
            <code>.mcp.json</code> — registers the Memmo MCP server
          </li>
          <li>
            <code>.claude/hooks/*</code> — session + before-edit hooks
          </li>
        </ul>
      </Step>

      <Step n={4} title="Use it in Claude Code">
        <p className="text-sm text-[var(--muted)]">
          Open Claude Code in this repo. It discovers the <code>memmo</code> MCP server and can
          call:
        </p>
        <div className="mt-3 space-y-2">
          <Tool name="get_repo_context()" desc="stack, recommended commands, and risk warnings" />
          <Tool name="search_memory(query)" desc="approved memories relevant to the task" />
          <Tool
            name="record_session_summary(...)"
            desc="submit what it did → proposes new memories for review"
          />
        </div>
        <p className="mt-4 text-sm text-[var(--muted)]">
          Only <strong>approved</strong> memories are served to agents. Review proposals in the{" "}
          <Link href={`/repos/${repoId}/inbox`} className="text-[var(--accent)]">
            inbox
          </Link>
          , and fill in this repo&apos;s context on the{" "}
          <Link href={`/repos/${repoId}`} className="text-[var(--accent)]">
            overview
          </Link>{" "}
          for richer results.
        </p>
      </Step>

      <Card className="mt-8 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Generated .mcp.json</h2>
          <CopyButton value={MCP_JSON} />
        </div>
        <p className="mt-1 text-xs text-[var(--muted)]">
          Written by <code>memmo init</code>. If Claude Code can&apos;t launch the server, ensure{" "}
          <code>memmo</code> is on your PATH.
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
