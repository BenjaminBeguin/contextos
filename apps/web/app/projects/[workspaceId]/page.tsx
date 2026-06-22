"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MEMORY_TYPES, MEMORY_STATUSES } from "@cortex/shared";
import { RepoPicker } from "../../../components/RepoPicker";
import {
  api,
  timeAgo,
  type WorkspaceDetail,
  type WorkspaceMemory,
  type AgentSessionSummary,
  type GeneratedDoc,
} from "../../../lib/api";
import { AppShell } from "../../../components/AppShell";
import { MemoryCard } from "../../../components/MemoryCard";
import { ProjectSettings } from "../../../components/ProjectSettings";
import { usePagination, Pagination } from "../../../components/Pagination";
import { useActiveWorkspace } from "../../../lib/workspace";
import { projectColor } from "../../../lib/projectColor";
import {
  Badge,
  Button,
  Card,
  Code,
  EmptyState,
  Input,
  Select,
  Spinner,
  StatusBadge,
  Textarea,
  cn,
} from "../../../components/ui";

type WsSession = AgentSessionSummary & { repoId: string; repoFullName: string };
type WsDoc = GeneratedDoc & { repoFullName: string };

const TABS = [
  "Overview",
  "Repos",
  "Memory",
  "Decisions",
  "Risks",
  "Sessions",
  "Docs",
  "Tools",
  "Setup",
  "Settings",
] as const;
type Tab = (typeof TABS)[number];

export default function ProjectPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  return (
    <AppShell>
      <Project workspaceId={workspaceId} />
    </AppShell>
  );
}

function Project({ workspaceId }: { workspaceId: string }) {
  const [tab, setTab] = useState<Tab>("Overview");
  const [repoFilter, setRepoFilter] = useState("");
  const { workspaces, setActiveId } = useActiveWorkspace();
  const role = workspaces.find((w) => w.id === workspaceId)?.role;
  const isOwner = role === "owner";

  // Keep the header switcher in sync with the project you're viewing.
  useEffect(() => setActiveId(workspaceId), [workspaceId, setActiveId]);

  const { data: ws } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api<WorkspaceDetail>(`/workspaces/${workspaceId}`),
  });

  const repos = ws?.repos ?? [];
  const showRepoFilter =
    ["Memory", "Decisions", "Risks", "Sessions", "Docs"].includes(tab) && repos.length > 1;

  const color = projectColor(workspaceId).color;

  return (
    <div>
      {/* Workspace main menu — sticky top bar with project context + section tabs */}
      <div className="sticky top-0 z-20 -mx-6 -mt-8 mb-6 border-b border-[var(--border)] bg-[var(--background)]/90 px-6 pb-0 pt-5 backdrop-blur">
        <div className="flex items-center gap-2.5">
          <span
            className="inline-block h-3 w-3 shrink-0 rounded-full"
            style={{ background: color, boxShadow: `0 0 12px ${color}` }}
            aria-hidden
          />
          <h1 className="text-lg font-semibold tracking-tight">{ws?.name ?? "Project"}</h1>
          <span className="text-xs text-[var(--muted)]">
            {repos.length} repo{repos.length === 1 ? "" : "s"} · {role ?? "member"}
          </span>
          <Link
            href="/dashboard"
            className="ml-auto text-xs text-[var(--muted)] transition hover:text-white"
          >
            All projects →
          </Link>
        </div>

        {/* Tab bar */}
        <div className="mt-3 flex flex-wrap gap-1">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm transition",
                t === tab
                  ? "border-[var(--accent)] text-white"
                  : "border-transparent text-[var(--muted)] hover:text-white",
              )}
            >
              {t}
              {t === "Memory" && (ws?.pendingMemories ?? 0) > 0 ? (
                <span
                  className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-500/20 px-1 text-[10px] font-semibold text-amber-300"
                  title={`${ws?.pendingMemories} awaiting review`}
                >
                  {ws?.pendingMemories}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {/* Repo filter (sections that span repos) */}
      {showRepoFilter ? (
        <div className="mt-4 flex items-center gap-2 text-sm text-[var(--muted)]">
          <span>Repo:</span>
          <Select value={repoFilter} onChange={(e) => setRepoFilter(e.target.value)}>
            <option value="">All repos</option>
            {repos.map((r) => (
              <option key={r.id} value={r.id}>
                {r.fullName}
              </option>
            ))}
          </Select>
        </div>
      ) : null}

      <div className="mt-6">
        {tab === "Overview" ? <Overview ws={ws} /> : null}
        {tab === "Repos" ? <ReposTab repos={repos} workspaceId={workspaceId} /> : null}
        {tab === "Memory" ? <MemoryTab workspaceId={workspaceId} repoId={repoFilter} /> : null}
        {tab === "Decisions" ? (
          <DecisionsTab workspaceId={workspaceId} repoId={repoFilter} repos={repos} />
        ) : null}
        {tab === "Risks" ? <RisksTab workspaceId={workspaceId} repoId={repoFilter} /> : null}
        {tab === "Sessions" ? <SessionsTab workspaceId={workspaceId} repoId={repoFilter} /> : null}
        {tab === "Docs" ? <DocsTab workspaceId={workspaceId} repoId={repoFilter} /> : null}
        {tab === "Tools" ? <ToolsTab /> : null}
        {tab === "Setup" ? <SetupTab /> : null}
        {tab === "Settings" ? <ProjectSettings workspaceId={workspaceId} isOwner={isOwner} /> : null}
      </div>
    </div>
  );
}

function Overview({ ws }: { ws?: WorkspaceDetail }) {
  if (!ws) return <Loading />;
  const totalMemories = ws.repos.reduce((n, r) => n + (r._count?.memories ?? 0), 0);
  const stats = [
    { label: "Repos", value: ws.repos.length },
    { label: "Memories", value: totalMemories },
    { label: "Members", value: ws.memberships.length },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((s) => (
        <Card key={s.label} className="p-6">
          <p className="text-sm text-[var(--muted)]">{s.label}</p>
          <p className="mt-1 text-3xl font-semibold">{s.value}</p>
        </Card>
      ))}
    </div>
  );
}

function ReposTab({
  repos,
  workspaceId,
}: {
  repos: WorkspaceDetail["repos"];
  workspaceId: string;
}) {
  const [adding, setAdding] = useState(false);
  return (
    <div>
      <div className="mb-4 flex justify-end">
        <Button variant="ghost" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancel" : "Add repo"}
        </Button>
      </div>
      {adding ? (
        <Card className="mb-4 p-6">
          <RepoPicker workspaceId={workspaceId} onCreated={() => setAdding(false)} />
        </Card>
      ) : null}
      {repos.length === 0 ? (
        <EmptyState title="No repos connected" description="Add a repo to start capturing memory." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {repos.map((r) => (
            <Link key={r.id} href={`/repos/${r.id}`} className="group">
              <Card hover className="h-full p-5">
                <h3 className="font-semibold transition group-hover:text-[var(--accent)]">
                  {r.fullName}
                </h3>
                <p className="mt-1 text-xs text-[var(--muted)]">{r._count?.memories ?? 0} memories</p>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

type MemorySort = "recent" | "oldest" | "confidence";

function sortMemories(list: WorkspaceMemory[], sort: MemorySort): WorkspaceMemory[] {
  const t = (s: string) => +new Date(s);
  return [...list].sort((a, b) => {
    if (sort === "recent") return t(b.createdAt) - t(a.createdAt);
    if (sort === "oldest") return t(a.createdAt) - t(b.createdAt);
    return b.confidence - a.confidence || t(b.updatedAt) - t(a.updatedAt);
  });
}

function MemoryTab({ workspaceId, repoId }: { workspaceId: string; repoId: string }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [type, setType] = useState("");
  const [sort, setSort] = useState<MemorySort>("recent");
  const params = new URLSearchParams();
  if (q) params.set("search", q);
  if (status) params.set("status", status);
  if (type) params.set("type", type);

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-memories", workspaceId, q, status, type],
    queryFn: () => api<WorkspaceMemory[]>(`/workspaces/${workspaceId}/memories?${params.toString()}`),
  });
  const memories = sortMemories(
    (data ?? []).filter((m) => !repoId || m.repoId === repoId),
    sort,
  );
  const { pageItems, page, setPage, totalPages, total } = usePagination(memories);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" className="min-w-56 flex-1" />
        <Select value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          {MEMORY_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select value={type} onChange={(e) => setType(e.target.value)}>
          <option value="">All types</option>
          {MEMORY_TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
        <Select value={sort} onChange={(e) => setSort(e.target.value as MemorySort)} title="Sort">
          <option value="recent">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="confidence">Confidence</option>
        </Select>
      </div>
      <MemoryList memories={pageItems} isLoading={isLoading} empty="No memories match." />
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} label="memories" />
    </div>
  );
}

function DecisionsTab({
  workspaceId,
  repoId,
  repos,
}: {
  workspaceId: string;
  repoId: string;
  repos: WorkspaceDetail["repos"];
}) {
  const qc = useQueryClient();
  const [text, setText] = useState("");
  const [why, setWhy] = useState("");
  const [pickRepo, setPickRepo] = useState(repos[0]?.id ?? "");
  const targetRepo = repoId || pickRepo;

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-memories", workspaceId, "decisions"],
    queryFn: () => api<WorkspaceMemory[]>(`/workspaces/${workspaceId}/memories?type=decision`),
  });
  const decisions = (data ?? [])
    .filter((d) => d.status !== "rejected" && d.status !== "archived")
    .filter((d) => !repoId || d.repoId === repoId)
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  const { pageItems, page, setPage, totalPages, total } = usePagination(decisions);

  const record = useMutation({
    mutationFn: () =>
      api(`/repos/${targetRepo}/memories`, {
        method: "POST",
        body: JSON.stringify({
          type: "decision",
          title: text.trim().slice(0, 140),
          content: why.trim() ? `${text.trim()}\n\nWhy: ${why.trim()}` : text.trim(),
          status: "approved",
          source: "decision_log",
          confidence: 0.9,
        }),
      }),
    onSuccess: () => {
      setText("");
      setWhy("");
      qc.invalidateQueries({ queryKey: ["workspace-memories"] });
    },
  });

  return (
    <div>
      <Card className="p-6">
        <h2 className="font-semibold">Record a decision</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          What changed (a feature added or removed) — and why. It becomes durable context agents
          retrieve.
        </p>
        <div className="mt-4 space-y-3">
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="e.g. Removed the pricing page from the landing"
          />
          <Textarea
            value={why}
            onChange={(e) => setWhy(e.target.value)}
            placeholder="Why? (optional)"
            rows={2}
          />
          <div className="flex flex-wrap items-center gap-2">
            {!repoId && repos.length > 1 ? (
              <Select value={pickRepo} onChange={(e) => setPickRepo(e.target.value)}>
                {repos.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.fullName}
                  </option>
                ))}
              </Select>
            ) : null}
            <Button
              onClick={() => record.mutate()}
              disabled={!text.trim() || !targetRepo}
              loading={record.isPending}
            >
              Record decision
            </Button>
          </div>
        </div>
      </Card>

      <div className="mt-6">
        {isLoading ? (
          <Loading />
        ) : decisions.length === 0 ? (
          <EmptyState
            title="No decisions yet"
            description="Record one above, or use the cortex decision command from your repo."
          />
        ) : (
          <>
            <ol className="relative space-y-4 border-l border-[var(--border)] pl-5">
              {pageItems.map((d) => (
                <li key={d.id} className="relative">
                  <span className="absolute -left-[1.45rem] top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--accent)]" />
                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                    <StatusBadge status={d.status} />
                    <span>{d.repoFullName}</span>
                    <span title={new Date(d.createdAt).toLocaleString()}>· {timeAgo(d.createdAt)}</span>
                  </div>
                  <h3 className="mt-1 font-medium">{d.title}</h3>
                  {d.content && d.content !== d.title ? (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-[var(--muted)]">{d.content}</p>
                  ) : null}
                </li>
              ))}
            </ol>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              onPage={setPage}
              label="decisions"
            />
          </>
        )}
      </div>
    </div>
  );
}

function RisksTab({ workspaceId, repoId }: { workspaceId: string; repoId: string }) {
  const [sort, setSort] = useState<MemorySort>("recent");
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-memories", workspaceId, "risks"],
    queryFn: () => api<WorkspaceMemory[]>(`/workspaces/${workspaceId}/memories?status=approved`),
  });
  const memories = sortMemories(
    (data ?? [])
      .filter((m) => m.type === "risk" || m.type === "failure")
      .filter((m) => !repoId || m.repoId === repoId),
    sort,
  );
  const { pageItems, page, setPage, totalPages, total } = usePagination(memories);
  return (
    <div>
      <div className="mb-2 flex justify-end">
        <Select value={sort} onChange={(e) => setSort(e.target.value as MemorySort)} title="Sort">
          <option value="recent">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="confidence">Confidence</option>
        </Select>
      </div>
      <MemoryList
        memories={pageItems}
        isLoading={isLoading}
        empty="No approved risks or failures yet."
      />
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} label="risks" />
    </div>
  );
}

function MemoryList({
  memories,
  isLoading,
  empty,
}: {
  memories: WorkspaceMemory[];
  isLoading: boolean;
  empty: string;
}) {
  if (isLoading) return <Loading />;
  if (memories.length === 0) return <EmptyState title={empty} />;
  return (
    <div className="mt-4 space-y-4">
      {memories.map((m) => (
        <div key={m.id}>
          <Link
            href={`/repos/${m.repoId}/memories`}
            className="mb-1 inline-block text-xs text-[var(--accent)] hover:underline"
          >
            {m.repoFullName}
          </Link>
          <MemoryCard memory={m} />
        </div>
      ))}
    </div>
  );
}

function SessionsTab({ workspaceId, repoId }: { workspaceId: string; repoId: string }) {
  const [q, setQ] = useState("");
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-sessions", workspaceId],
    queryFn: () => api<WsSession[]>(`/workspaces/${workspaceId}/sessions`),
  });
  const ql = q.trim().toLowerCase();
  const sessions = (data ?? [])
    .filter((s) => !repoId || s.repoId === repoId)
    .filter((s) => !ql || `${s.task ?? ""} ${s.summary ?? ""}`.toLowerCase().includes(ql));
  const { pageItems, page, setPage, totalPages, total } = usePagination(sessions);
  if (isLoading) return <Loading />;
  return (
    <div>
      <Input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Filter sessions…"
        className="mb-4 max-w-sm"
      />
      {sessions.length === 0 ? (
        <EmptyState title="No sessions yet" description="Agent sessions appear here as Claude Code works." />
      ) : (
        <div className="space-y-3">
          {pageItems.map((s) => (
            <Card key={s.id} className="p-4">
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <span className="flex items-center gap-2">
                  <Badge label={s.agent} />
                  <span>{s.repoFullName}</span>
                </span>
                <span>{timeAgo(s.createdAt)}</span>
              </div>
              <p className="mt-2 font-medium">{s.task ?? "Session"}</p>
              {s.summary ? <p className="mt-1 text-sm text-[var(--muted)]">{s.summary}</p> : null}
            </Card>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} label="sessions" />
    </div>
  );
}

function DocsTab({ workspaceId, repoId }: { workspaceId: string; repoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-docs", workspaceId],
    queryFn: () => api<WsDoc[]>(`/workspaces/${workspaceId}/docs`),
  });
  const docs = (data ?? []).filter((d) => !repoId || d.repoId === repoId);
  const { pageItems, page, setPage, totalPages, total } = usePagination(docs);
  if (isLoading) return <Loading />;
  if (docs.length === 0)
    return <EmptyState title="No docs yet" description="Generated docs for the project's repos show up here." />;
  return (
    <div>
      <div className="space-y-3">
        {pageItems.map((d) => (
          <Link key={d.id} href={`/repos/${d.repoId}/docs`}>
            <Card hover className="p-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">{d.title}</h3>
                <span className="text-xs text-[var(--muted)]">{d.repoFullName}</span>
              </div>
              <p className="mt-1 text-xs text-[var(--muted)]">
                {d.type} · updated {timeAgo(d.updatedAt)}
              </p>
            </Card>
          </Link>
        ))}
      </div>
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} label="docs" />
    </div>
  );
}

function ToolsTab() {
  const tools = [
    { href: "/search", title: "Search", desc: "Full-text search across every memory in the project." },
    { href: "/chat", title: "Chat", desc: "Ask questions grounded in the project's approved memory." },
    { href: "/graph", title: "Graph", desc: "Visualize repos, memories, and sessions as a network." },
    { href: "/usage", title: "Impact", desc: "What Cortex is doing — context injected, risks flagged, knowledge captured." },
  ];
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {tools.map((t) => (
        <Link key={t.href} href={t.href} className="group">
          <Card hover className="h-full p-5">
            <h3 className="font-semibold transition group-hover:text-[var(--accent)]">{t.title}</h3>
            <p className="mt-1 text-sm text-[var(--muted)]">{t.desc}</p>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function SetupTab() {
  return (
    <Card className="max-w-2xl p-6">
      <h2 className="font-semibold">Connect Claude Code</h2>
      <p className="mt-1 text-sm text-[var(--muted)]">
        Install the CLI and connect each repo. See the full reference in{" "}
        <Link href="/docs" className="text-[var(--accent)]">
          Documentation
        </Link>
        .
      </p>
      <div className="mt-4">
        <Code>{`npm install -g @mxbenjaminbeguin/cortex
cortex login
cortex init      # in your repo
cortex status`}</Code>
      </div>
    </Card>
  );
}

function Loading() {
  return (
    <p className="flex items-center gap-2 text-[var(--muted)]">
      <Spinner /> Loading…
    </p>
  );
}
