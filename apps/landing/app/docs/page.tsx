import type { Metadata } from "next";
import { APP_URL, APP_LIVE } from "../../lib/api";

export const metadata: Metadata = {
  title: "Memmo — Setup & Docs",
  description: "Install Memmo and connect Claude Code to your team's operational memory.",
};

function Code({ children }: { children: React.ReactNode }) {
  return (
    <pre className="glow-ring overflow-x-auto rounded-xl border border-white/10 bg-black/60 p-4 text-sm text-[var(--text)]">
      <code>{children}</code>
    </pre>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <div className="mb-3 flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-semibold text-black">
          {n}
        </span>
        <h2 className="text-xl font-semibold">{title}</h2>
      </div>
      <div className="space-y-3 text-[var(--muted)]">{children}</div>
    </section>
  );
}

export default function DocsPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="aurora opacity-60" />
      <header className="sticky top-0 z-20 border-b border-white/5 bg-[var(--background)]/70 backdrop-blur-xl">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-block h-4 w-4 rotate-45 rounded-sm bg-gradient-to-br from-violet-400 to-cyan-400" />
            Memmo
          </a>
          {APP_LIVE ? (
            <a href={`${APP_URL}/login`} className="text-sm text-[var(--muted)] hover:text-white">
              Sign in
            </a>
          ) : (
            <a href="/#waitlist" className="text-sm text-[var(--muted)] hover:text-white">
              Join waitlist
            </a>
          )}
        </div>
      </header>

      <main className="relative mx-auto max-w-3xl px-6 py-16">
        <p className="text-xs uppercase tracking-[0.3em] text-cyan-300/70">Documentation</p>
        <h1 className="gradient-text mt-3 text-4xl font-semibold">Set up Memmo</h1>
        <p className="mt-4 text-[var(--muted)]">
          Memmo gives Claude Code your team&apos;s operational memory through the Model Context
          Protocol. Connect a repo once, then every Claude Code session can retrieve approved
          memories, repo context, and risk warnings before it acts.
        </p>

        <Step n={1} title="Prerequisites">
          <ul className="list-disc space-y-1 pl-5">
            <li>Node.js 20+ and a terminal</li>
            <li>Claude Code installed in your repo</li>
            <li>A Memmo account (create one when you sign in)</li>
          </ul>
        </Step>

        <Step n={2} title="Install the CLI">
          <Code>{`npm install -g memmo`}</Code>
        </Step>

        <Step n={3} title="Authenticate">
          <p>Log in to store an API token locally (in ~/.memmo/credentials.json):</p>
          <Code>{`memmo login`}</Code>
        </Step>

        <Step n={4} title="Connect your repo">
          <p>
            From the root of your repository, link it to a Memmo workspace. This writes a local
            config and generates the Claude Code assets.
          </p>
          <Code>{`memmo init`}</Code>
          <p>This creates:</p>
          <Code>{`.memmo/config.json          # repo link
CLAUDE.md                       # guidance for the agent
.mcp.json                       # registers the Memmo MCP server
.claude/settings.json           # SessionStart / PreToolUse / SessionEnd hooks`}</Code>
        </Step>

        <Step n={5} title="Use it in Claude Code">
          <p>
            Open Claude Code in the repo. It discovers the <code>memmo</code> MCP server and can
            call these tools:
          </p>
          <Code>{`search_memory(query)      → approved memories for this repo
get_repo_context()        → stack, commands, risks, warnings`}</Code>
          <p>
            New learnings captured during sessions show up as <strong>proposed</strong> memories in
            your inbox. Approve them and they become available to every future session.
          </p>
        </Step>

        <Step n={6} title="Use it in Claude Desktop (optional)">
          <p>
            Claude Desktop runs MCP servers globally, so tell Memmo which repo to serve with{" "}
            <code>--repo</code> (the repo ID is on its dashboard page). Add it to your Claude Desktop
            config:
          </p>
          <Code>{`// macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
{
  "mcpServers": {
    "memmo": { "command": "memmo", "args": ["mcp", "--repo", "<repoId>"] }
  }
}`}</Code>
          <p>
            Restart Claude Desktop and the <code>search_memory</code> / <code>get_repo_context</code>{" "}
            / <code>propose_memories</code> tools become available. Note: the automatic hooks
            (context injection, risk warnings, session capture) are Claude Code-only — Desktop gets
            the manual tools.
          </p>
        </Step>

        <Step n={7} title="Review & approve memory">
          <p>
            Manage memory in the web app — review the inbox, approve or reject proposals, and browse
            the approved library. Approved memories are the only ones exposed to agents.
          </p>
          <a
            href={APP_LIVE ? `${APP_URL}/dashboard` : "/#waitlist"}
            className="brand-gradient inline-block rounded-xl px-5 py-2.5 text-sm font-semibold text-white transition hover:brightness-110"
          >
            {APP_LIVE ? "Open the dashboard →" : "Join the waitlist →"}
          </a>
        </Step>

        <div className="mt-16 rounded-2xl border border-white/10 bg-white/5 p-6 text-sm text-[var(--muted)]">
          Memory is always scoped to a repo and never leaks across workspaces. Proposed memories are
          treated as suggestions until a human approves them.
        </div>
      </main>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-[var(--muted)]">
        Memmo — Never explain your codebase to AI twice.
      </footer>
    </div>
  );
}
