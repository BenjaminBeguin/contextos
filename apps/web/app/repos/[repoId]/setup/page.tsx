"use client";

import { use } from "react";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { Card, Code } from "../../../../components/ui";

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
      <h1 className="text-2xl font-semibold">Connect Claude Code</h1>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Install the CLI, authenticate, and connect this repo. Claude Code will then retrieve
        approved memories through the ContextOS MCP server.
      </p>

      <Step n={1} title="Install the CLI">
        <Code>{`npm install -g @mxbenjaminbeguin/cortex`}</Code>
      </Step>

      <Step n={2} title="Authenticate">
        <Code>{`contextos login`}</Code>
      </Step>

      <Step n={3} title="Connect this repo">
        <Code>{`contextos init --repo ${repoId}`}</Code>
        <p className="mt-2 text-sm text-[var(--muted)]">
          This writes <code>.contextos/config.json</code>, generates <code>CLAUDE.md</code>,{" "}
          <code>.mcp.json</code>, and Claude Code hooks.
        </p>
      </Step>

      <Step n={4} title="Verify the MCP connection">
        <p className="text-sm text-[var(--muted)]">
          Open Claude Code in this repo. It will discover the <code>contextos</code> MCP server and
          can call <code>search_memory</code> and <code>get_repo_context</code>.
        </p>
      </Step>

      <Card className="mt-8 p-6">
        <h2 className="font-semibold">Generated .mcp.json</h2>
        <div className="mt-3">
          <Code>
            {JSON.stringify(
              {
                mcpServers: {
                  contextos: { type: "stdio", command: "contextos", args: ["mcp"] },
                },
              },
              null,
              2,
            )}
          </Code>
        </div>
      </Card>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
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
