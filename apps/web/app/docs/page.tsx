"use client";

import type { ReactNode } from "react";
import { AppShell } from "../../components/AppShell";
import { Card, Code, PageHeader } from "../../components/ui";

export default function DocsPage() {
  return (
    <AppShell>
      <Docs />
    </AppShell>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="mt-3 space-y-3 text-sm text-[var(--muted)]">{children}</div>
    </section>
  );
}

function Tool({ name, desc }: { name: string; desc: string }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-[var(--border)] py-2 last:border-0 sm:flex-row sm:gap-3">
      <code className="shrink-0 font-mono text-xs text-cyan-200 sm:w-56">{name}</code>
      <span>{desc}</span>
    </div>
  );
}

const NAV = [
  ["how", "How it works"],
  ["quickstart", "Quick start"],
  ["cli", "CLI commands"],
  ["mcp", "MCP tools"],
  ["hooks", "Automatic hooks"],
  ["lifecycle", "Memory lifecycle"],
  ["triage", "Auto-triage & dedup"],
  ["desktop", "Claude Desktop"],
  ["model", "Projects & repos"],
] as const;

function Docs() {
  return (
    <div>
      <PageHeader
        title="Documentation"
        description="How Cortex captures, curates, and serves your team's operational memory to AI coding agents."
      />

      <div className="grid gap-8 lg:grid-cols-[180px_1fr]">
        {/* On-page nav */}
        <nav className="hidden lg:block">
          <div className="sticky top-24 space-y-1 text-sm">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#${id}`}
                className="block rounded-md px-2 py-1 text-[var(--muted)] transition hover:bg-white/5 hover:text-white"
              >
                {label}
              </a>
            ))}
          </div>
        </nav>

        <div className="max-w-2xl space-y-10">
          <Section id="how" title="How it works">
            <p>
              Cortex is an operational-memory layer for AI coding agents. The loop:{" "}
              <strong className="text-white">agents work → knowledge is captured → a human approves
              it → it&apos;s injected back</strong>{" "}
              into the next session through the Model Context Protocol (MCP).
            </p>
            <p>
              Memory is scoped to a <strong className="text-white">repo</strong> and never leaks
              across projects. Approved memories are the only ones served to agents; proposals stay
              in the inbox until reviewed.
            </p>
          </Section>

          <Section id="quickstart" title="Quick start">
            <p>Install the CLI, sign in, and connect a repo from its root:</p>
            <Code>{`npm install -g @mxbenjaminbeguin/cortex
cortex login
cortex init        # writes .mcp.json, CLAUDE.md, and Claude Code hooks
cortex status      # verify the setup`}</Code>
            <p>
              Open Claude Code in that repo — it discovers the <code>cortex</code> MCP server and the
              hooks start working automatically.
            </p>
          </Section>

          <Section id="cli" title="CLI commands">
            <Card className="p-4">
              <Tool name="cortex login" desc="Authenticate and store an API token in ~/.cortex." />
              <Tool name="cortex init" desc="Connect this repo and generate Claude Code assets." />
              <Tool name="cortex status" desc="Check whether Cortex is set up in this repo." />
              <Tool name="cortex scan" desc="Scan the codebase and propose starter memories (--agent uses local Claude Code, --server uses the workspace key)." />
              <Tool name="cortex chat [q]" desc="Chat with this repo's memory using your own Anthropic key or Claude subscription." />
              <Tool name="cortex claude install" desc="(Re)generate CLAUDE.md, .mcp.json, and hooks." />
              <Tool name="cortex mcp" desc="Run the MCP stdio server (launched by Claude Code / Desktop)." />
              <Tool name="cortex uninstall" desc="Remove all Cortex wiring from this repo." />
            </Card>
          </Section>

          <Section id="mcp" title="MCP tools">
            <p>The MCP server exposes these tools to the agent:</p>
            <Card className="p-4">
              <Tool name="get_repo_context" desc="Stack, package manager, key commands, and known risks for the repo." />
              <Tool name="search_memory" desc="Search approved memories relevant to a task." />
              <Tool name="get_relevant_warnings" desc="Risk/failure memories for the files about to be edited." />
              <Tool name="propose_memories" desc="Record durable knowledge as proposed memories for review." />
              <Tool name="record_session_summary" desc="Submit a session summary so Cortex proposes new memories." />
            </Card>
          </Section>

          <Section id="hooks" title="Automatic hooks">
            <p>
              <code>cortex init</code> registers Claude Code hooks in{" "}
              <code>.claude/settings.json</code> so the loop runs without manual calls:
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-white">SessionStart</strong> — injects repo context (stack,
                commands, risks) at the start of every session.
              </li>
              <li>
                <strong className="text-white">PreToolUse</strong> — surfaces risk warnings for a
                file before it&apos;s edited (once per file per session).
              </li>
              <li>
                <strong className="text-white">SessionEnd</strong> — reads the transcript and
                proposes new memories from the work.
              </li>
            </ul>
            <p>
              Hooks fail open: if Cortex isn&apos;t set up or is offline, they exit silently and
              never block your session.
            </p>
          </Section>

          <Section id="lifecycle" title="Memory lifecycle">
            <p>
              Every memory has a status: <strong className="text-white">proposed</strong> (in the
              inbox), <strong className="text-white">approved</strong> (served to agents),{" "}
              <strong className="text-white">rejected</strong>, or{" "}
              <strong className="text-white">archived</strong>. Approving a memory that restates an
              older approved one <strong className="text-white">supersedes</strong> it. Approved
              memories not retrieved in 30 days are flagged <strong className="text-white">stale</strong>{" "}
              for re-review.
            </p>
          </Section>

          <Section id="triage" title="Auto-triage & dedup">
            <p>
              Near-duplicate proposals are skipped automatically so the inbox stays lean. In a
              project&apos;s <strong className="text-white">Settings → Automatic triage</strong>, set
              confidence bands: at/above the approve threshold a proposal is auto-approved, below the
              reject threshold it&apos;s auto-rejected, and the middle band lands in the inbox for a
              human call.
            </p>
          </Section>

          <Section id="desktop" title="Claude Desktop">
            <p>
              Claude Desktop runs MCP servers globally, so point Cortex at a repo with{" "}
              <code>--repo</code> (the repo ID is on its page). Add to your Desktop config:
            </p>
            <Code>{`// ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "cortex": { "command": "cortex", "args": ["mcp", "--repo", "<repoId>"] }
  }
}`}</Code>
            <p>
              Desktop gets the manual tools; the automatic hooks remain a Claude Code feature.
            </p>
          </Section>

          <Section id="model" title="Projects & repos">
            <p>
              A <strong className="text-white">project</strong> is your team&apos;s workspace — it
              holds members, the join code, an optional BYOK Anthropic key, and triage rules, and it
              groups one or more connected <strong className="text-white">repos</strong>. Memory,
              sessions, risks, and docs belong to a repo; project views aggregate across repos and
              let you filter by repo.
            </p>
          </Section>
        </div>
      </div>
    </div>
  );
}
