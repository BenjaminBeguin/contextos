import { WaitlistForm } from "../components/WaitlistForm";
import { BrainHero } from "../components/BrainHero";
import { Reveal } from "../components/Reveal";
import { Spotlight } from "../components/Spotlight";
import { APP_URL } from "../lib/api";

const features = [
  {
    title: "Repo Memory",
    body: "Project conventions, architecture, commands, risky files, and deployment rules — structured and queryable.",
    glyph: "◈",
  },
  {
    title: "Session Learning",
    body: "Capture what Claude Code tried, what failed, what worked, and what should be remembered.",
    glyph: "⟁",
  },
  {
    title: "Memory Inbox",
    body: "Review, approve, reject, edit, and scope every new memory before it reaches an agent.",
    glyph: "❖",
  },
  {
    title: "Risk Warnings",
    body: "Warn agents before they touch sensitive files or repeat a known outage.",
    glyph: "⚠",
  },
  {
    title: "Living Docs",
    body: "Generate onboarding guides, runbooks, and architecture notes from actual work.",
    glyph: "❒",
  },
  {
    title: "MCP Integration",
    body: "Expose memory directly to Claude Code through the Model Context Protocol.",
    glyph: "⌁",
  },
];

const steps = [
  "Install Cortex in your repo",
  "Connect Claude Code through MCP and hooks",
  "Let agents work normally",
  "Review proposed memories",
  "Future sessions become smarter",
];

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    blurb: "For solo developers trying it out.",
    features: ["1 repo", "100 memories", "Claude Code via MCP", "Community support"],
    cta: "Join waitlist",
    highlight: false,
  },
  {
    name: "Team",
    price: "$20",
    cadence: "/ user / mo",
    blurb: "For engineering teams shipping with agents.",
    features: [
      "Unlimited repos & memories",
      "Memory approval workflow",
      "Usage analytics",
      "GitHub integration",
      "Priority support",
    ],
    cta: "Join waitlist",
    highlight: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    cadence: "",
    blurb: "For orgs with security & compliance needs.",
    features: ["SSO & SAML", "Audit logs", "Advanced permissions", "Private deployment", "SLA"],
    cta: "Talk to us",
    highlight: false,
  },
];

function Terminal({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="glow-ring overflow-hidden rounded-2xl border border-white/10 bg-black/60 text-left backdrop-blur">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="h-3 w-3 rounded-full bg-red-500/70" />
        <span className="h-3 w-3 rounded-full bg-yellow-500/70" />
        <span className="h-3 w-3 rounded-full bg-green-500/70" />
        <span className="ml-3 text-xs text-[var(--muted)]">{title}</span>
      </div>
      <pre className="overflow-x-auto p-5 text-sm leading-relaxed text-[var(--text)]">
        <code>{children}</code>
      </pre>
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-20 border-b border-white/5 bg-[var(--background)]/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <a href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="inline-block h-4 w-4 rotate-45 rounded-sm bg-gradient-to-br from-violet-400 to-cyan-400" />
          Cortex
        </a>
        <nav className="flex items-center gap-5 text-sm text-[var(--muted)]">
          <a href="#features" className="hidden hover:text-white sm:inline">
            Features
          </a>
          <a href="#how" className="hidden hover:text-white sm:inline">
            How it works
          </a>
          <a href="#start" className="hidden hover:text-white sm:inline">
            Setup
          </a>
          <a href="#pricing" className="hidden hover:text-white sm:inline">
            Pricing
          </a>
          <a href="/docs" className="hidden hover:text-white sm:inline">
            Docs
          </a>
          <a href={`${APP_URL}/login`} className="hover:text-white">
            Sign in
          </a>
          <a
            href="#waitlist"
            className="shine rounded-xl bg-gradient-to-r from-violet-500 to-cyan-400 px-4 py-1.5 font-semibold text-black transition hover:opacity-90"
          >
            Join waitlist
          </a>
        </nav>
      </div>
    </header>
  );
}

export default function LandingPage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <Nav />

      {/* Hero */}
      <section className="relative">
        <div className="aurora" />
        <Spotlight />
        <div className="pointer-events-none absolute inset-0 grid-bg" />
        <div className="relative mx-auto max-w-6xl px-6 pt-24 pb-20 text-center">
          <p className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-[var(--muted)] backdrop-blur">
            <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
            Operational memory for AI coding agents
          </p>
          <h1 className="gradient-text mx-auto max-w-4xl text-6xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
            Give Claude Code your team&apos;s memory.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-[var(--muted)]">
            Cortex turns your repo, agent sessions, docs, and past mistakes into living
            operational context — injected into Claude Code before it acts.
          </p>

          <div id="waitlist" className="mt-10 scroll-mt-24">
            <WaitlistForm source="hero" />
          </div>

          {/* 3D brain: memory = brain, with signals flowing in and out */}
          <div className="mt-6">
            <BrainHero />
          </div>

          <div className="mx-auto -mt-4 max-w-2xl">
            <Terminal title="cortex · session">
              {`> claude code session
  ↳ Cortex learns
  ↳ memory approved
  ↳ future agents get smarter ✦`}
            </Terminal>
          </div>
        </div>
      </section>

      {/* Problem / Solution */}
      <Section>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="glass rounded-2xl p-8">
            <p className="text-xs uppercase tracking-widest text-violet-300">The problem</p>
            <h2 className="mt-3 text-2xl font-semibold">AI agents forget how your company works.</h2>
            <p className="mt-3 text-[var(--muted)]">
              They edit files, run commands, and ship changes — but never remember your
              architecture, deployment rules, past outages, or hidden workflows. So they repeat
              mistakes and need constant supervision.
            </p>
          </div>
          <div className="glass rounded-2xl p-8">
            <p className="text-xs uppercase tracking-widest text-cyan-300">The solution</p>
            <h2 className="mt-3 text-2xl font-semibold">A living memory layer for your team.</h2>
            <p className="mt-3 text-[var(--muted)]">
              Cortex captures useful knowledge from real engineering work, turns it into
              structured memory, and feeds the right context back into Claude Code at the moment it
              matters.
            </p>
          </div>
        </div>
      </Section>

      {/* Features */}
      <Section id="features">
        <h2 className="text-center text-3xl font-semibold sm:text-4xl">
          Everything agents need to stop starting from zero.
        </h2>
        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="glass rounded-2xl p-6">
              <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500/30 to-cyan-400/20 text-lg text-cyan-200">
                {f.glyph}
              </div>
              <h3 className="font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm text-[var(--muted)]">{f.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* How it works */}
      <Section id="how">
        <h2 className="text-center text-3xl font-semibold sm:text-4xl">How it works</h2>
        <ol className="mt-12 grid gap-4 sm:grid-cols-5">
          {steps.map((s, i) => (
            <li key={s} className="glass rounded-2xl p-5">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 text-sm font-semibold text-black">
                {i + 1}
              </div>
              <p className="text-sm text-[var(--muted)]">{s}</p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Quickstart */}
      <Section id="start">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300">Get started</p>
            <h2 className="mt-3 text-3xl font-semibold sm:text-4xl">
              Connected to Claude Code in under a minute.
            </h2>
            <p className="mt-3 text-[var(--muted)]">
              Install the CLI, sign in, and link your repo. Cortex registers an MCP
              server so Claude Code can retrieve your team&apos;s memory automatically.
            </p>
            <ul className="mt-5 space-y-2 text-sm text-[var(--muted)]">
              <li className="flex items-center gap-2">
                <span className="text-cyan-300">✓</span> Works with your existing repos
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-300">✓</span> No code changes — just `.mcp.json` + `CLAUDE.md`
              </li>
              <li className="flex items-center gap-2">
                <span className="text-cyan-300">✓</span> Memory stays scoped to each repo
              </li>
            </ul>
            <a
              href="/docs"
              className="mt-6 inline-block rounded-xl border border-white/15 px-5 py-2.5 text-sm font-semibold transition hover:bg-white/5"
            >
              Full setup guide →
            </a>
          </div>

          <div className="space-y-4">
            <Terminal title="your-repo — setup">
              {`# 1 · install the CLI
npm install -g @mxbenjaminbeguin/cortex

# 2 · authenticate
cortex login

# 3 · connect this repo
cortex init

✓ wrote .mcp.json, CLAUDE.md, hooks
✓ Claude Code now has your repo's memory`}
            </Terminal>
            <div className="flex flex-wrap gap-2">
              {["search_memory", "get_repo_context", "record_session_summary"].map((t) => (
                <span
                  key={t}
                  className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 font-mono text-xs text-cyan-200"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </Section>

      {/* Example */}
      <Section>
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-widest text-cyan-300">Before it touches code</p>
            <h2 className="mt-3 text-3xl font-semibold">
              Claude knows the history before editing billing.
            </h2>
            <p className="mt-3 text-[var(--muted)]">
              Memory is retrieved and scoped to the repo and task — so the agent walks in already
              knowing the landmines.
            </p>
          </div>
          <Terminal title="get_repo_context · acme/billing-api">
            {`Relevant context:
- Billing uses Stripe webhooks.
- Duplicate invoice outage happened in March.
- Always check idempotency keys.
- Run make test-billing before opening a PR.
- Do not edit invoices_v1 tables.`}
          </Terminal>
        </div>
      </Section>

      {/* Target users */}
      <Section>
        <h2 className="text-center text-3xl font-semibold sm:text-4xl">
          Built for AI-native engineering teams.
        </h2>
        <ul className="mx-auto mt-10 grid max-w-3xl gap-3 sm:grid-cols-2">
          {[
            "Startups using Claude Code",
            "Teams with fast-moving repos",
            "Engineering orgs with tribal knowledge",
            "Platform teams managing risky workflows",
            "Founders who want agents to work safely",
          ].map((t) => (
            <li key={t} className="glass flex items-center gap-3 rounded-xl px-4 py-3 text-sm">
              <span className="text-cyan-300">▹</span>
              {t}
            </li>
          ))}
        </ul>
      </Section>

      {/* Pricing */}
      <Section id="pricing">
        <h2 className="text-center text-3xl font-semibold sm:text-4xl">
          Simple pricing that scales with your team.
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-center text-[var(--muted)]">
          Start free. Upgrade when memory becomes mission-critical.
        </p>
        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`glass rounded-2xl p-7 ${
                t.highlight ? "conic-border lg:-translate-y-3" : ""
              }`}
            >
              {t.highlight ? (
                <span className="mb-3 inline-block rounded-full bg-gradient-to-r from-violet-500 to-cyan-400 px-3 py-0.5 text-xs font-semibold text-black">
                  Most popular
                </span>
              ) : null}
              <h3 className="text-lg font-semibold">{t.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-3xl font-semibold">{t.price}</span>
                <span className="text-sm text-[var(--muted)]">{t.cadence}</span>
              </div>
              <p className="mt-2 text-sm text-[var(--muted)]">{t.blurb}</p>
              <ul className="mt-5 space-y-2 text-sm">
                {t.features.map((f) => (
                  <li key={f} className="flex items-center gap-2">
                    <span className="text-cyan-300">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href={t.cta === "Talk to us" ? "mailto:founders@cortex.dev" : "#waitlist"}
                className={`mt-6 block rounded-xl px-4 py-2.5 text-center text-sm font-semibold transition ${
                  t.highlight
                    ? "shine bg-gradient-to-r from-violet-500 to-cyan-400 text-black hover:opacity-90"
                    : "border border-white/15 hover:bg-white/5"
                }`}
              >
                {t.cta}
              </a>
            </div>
          ))}
        </div>
      </Section>

      {/* Final CTA */}
      <section className="relative">
        <div className="aurora opacity-70" />
        <div className="relative mx-auto max-w-3xl px-6 py-28 text-center">
          <h2 className="gradient-text text-4xl font-semibold sm:text-5xl">
            Make every AI coding session compound.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[var(--muted)]">
            Join the waitlist and be first to give your agents a memory that grows with your team.
          </p>
          <div className="mt-10">
            <WaitlistForm source="footer-cta" />
          </div>
        </div>
      </section>

      <footer className="border-t border-white/5 py-8 text-center text-sm text-[var(--muted)]">
        Cortex — Operational memory for AI coding agents.
      </footer>
    </div>
  );
}

function Section({ children, id }: { children: React.ReactNode; id?: string }) {
  return (
    <section id={id} className="relative border-t border-white/5">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <Reveal>{children}</Reveal>
      </div>
    </section>
  );
}
