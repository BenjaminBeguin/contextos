import Link from "next/link";
import { Code } from "../components/ui";

const features = [
  {
    title: "Repo Memory",
    body: "Project conventions, architecture, commands, risky files, and deployment rules.",
  },
  {
    title: "Session Learning",
    body: "Capture what Claude Code tried, what failed, what worked, and what should be remembered.",
  },
  {
    title: "Memory Inbox",
    body: "Review, approve, reject, edit, and scope new memories.",
  },
  {
    title: "Risk Warnings",
    body: "Warn agents before they touch sensitive files or repeat known mistakes.",
  },
  {
    title: "Living Docs",
    body: "Generate onboarding guides, runbooks, architecture notes, and known-risk docs from actual work.",
  },
  {
    title: "MCP Integration",
    body: "Expose memory directly to Claude Code using Model Context Protocol.",
  },
];

const steps = [
  "Install ContextOS in your repo",
  "Connect Claude Code through MCP and hooks",
  "Let agents work normally",
  "Review proposed memories",
  "Future sessions become smarter",
];

function Nav() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-semibold">
          <span className="inline-block h-4 w-4 rounded-sm bg-[var(--accent)]" />
          ContextOS
        </Link>
        <nav className="flex items-center gap-4 text-sm text-[var(--muted)]">
          <a href="#features" className="hover:text-white">
            Features
          </a>
          <a href="#how" className="hover:text-white">
            How it works
          </a>
          <Link
            href="/login"
            className="rounded-lg bg-[var(--accent)] px-3 py-1.5 font-medium text-white"
          >
            Start free
          </Link>
        </nav>
      </div>
    </header>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav />

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pt-20 pb-16 text-center">
        <p className="mb-4 inline-block rounded-full border border-[var(--border)] px-3 py-1 text-xs text-[var(--muted)]">
          Operational memory for AI coding agents
        </p>
        <h1 className="mx-auto max-w-3xl text-5xl font-semibold leading-tight tracking-tight">
          Give Claude Code your team&apos;s memory.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--muted)]">
          ContextOS turns your repo, agent sessions, docs, and past mistakes into living
          operational context for AI coding agents.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-white"
          >
            Install for Claude Code
          </Link>
          <a
            href="#example"
            className="rounded-lg border border-[var(--border)] px-5 py-2.5 font-medium hover:bg-white/5"
          >
            View demo
          </a>
        </div>
        <div className="mx-auto mt-12 max-w-3xl">
          <Code>
            {`Claude Code session  →  ContextOS learns  →  Memory approved  →  Future agents get smarter`}
          </Code>
        </div>
      </section>

      {/* Problem */}
      <Section>
        <h2 className="text-3xl font-semibold">AI agents forget how your company works.</h2>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          AI coding agents can edit files, run commands, and ship changes. But they do not
          automatically remember your architecture, deployment rules, past outages, team
          conventions, or hidden workflows. That means they repeat mistakes and require constant
          supervision.
        </p>
      </Section>

      {/* Solution */}
      <Section>
        <h2 className="text-3xl font-semibold">A living memory layer for engineering teams.</h2>
        <p className="mt-4 max-w-2xl text-[var(--muted)]">
          ContextOS captures useful knowledge from real engineering work, turns it into structured
          memory, and injects the right context back into Claude Code before it acts.
        </p>
      </Section>

      {/* Features */}
      <Section id="features">
        <h2 className="text-3xl font-semibold">Everything agents need to stop starting from zero.</h2>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-6"
            >
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section id="how">
        <h2 className="text-3xl font-semibold">How it works</h2>
        <ol className="mt-8 grid gap-4 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li
              key={s}
              className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-5"
            >
              <div className="mb-3 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent)] text-sm font-semibold text-white">
                {i + 1}
              </div>
              <p className="text-sm text-[var(--muted)]">{s}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Example */}
      <Section id="example">
        <h2 className="text-3xl font-semibold">
          Before Claude edits billing code, it knows the history.
        </h2>
        <div className="mt-6 max-w-3xl">
          <Code>
            {`Relevant context:
- Billing uses Stripe webhooks.
- Duplicate invoice outage happened in March.
- Always check idempotency keys.
- Run make test-billing before opening a PR.
- Do not edit invoices_v1 tables.`}
          </Code>
        </div>
      </Section>

      {/* Target users */}
      <Section>
        <h2 className="text-3xl font-semibold">Built for AI-native engineering teams.</h2>
        <ul className="mt-6 grid max-w-3xl gap-2 text-[var(--muted)] sm:grid-cols-2">
          <li>• Startups using Claude Code</li>
          <li>• Teams with fast-moving repos</li>
          <li>• Engineering orgs with tribal knowledge</li>
          <li>• Platform teams managing risky workflows</li>
          <li>• Founders who want agents to work safely</li>
        </ul>
      </Section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24 text-center">
        <h2 className="text-4xl font-semibold">Make every AI coding session compound.</h2>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="rounded-lg bg-[var(--accent)] px-5 py-2.5 font-medium text-white"
          >
            Start free
          </Link>
          <a
            href="#how"
            className="rounded-lg border border-[var(--border)] px-5 py-2.5 font-medium hover:bg-white/5"
          >
            Install CLI
          </a>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-8 text-center text-sm text-[var(--muted)]">
        ContextOS — Operational memory for AI coding agents.
      </footer>
    </div>
  );
}

function Section({
  children,
  id,
}: {
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className="border-t border-[var(--border)]">
      <div className="mx-auto max-w-6xl px-6 py-16">{children}</div>
    </section>
  );
}
