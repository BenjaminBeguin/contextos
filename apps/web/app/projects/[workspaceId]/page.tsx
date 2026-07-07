"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { MEMORY_TYPES, MEMORY_STATUSES } from "@cortex/shared";
import { RepoPicker } from "../../../components/RepoPicker";
import { RepoSetupDrawer } from "../../../components/RepoSetupDrawer";
import {
  api,
  getWorkspaceReviews,
  timeAgo,
  type WorkspaceDetail,
  type WorkspaceMemory,
  type WorkspaceReview,
  type AgentSessionSummary,
  type GeneratedDoc,
} from "../../../lib/api";
import { AppShell } from "../../../components/AppShell";
import { MemoryCard } from "../../../components/MemoryCard";
import { ProjectSettings } from "../../../components/ProjectSettings";
import { SearchTool } from "../../../components/tools/SearchTool";
import { ChatTool } from "../../../components/tools/ChatTool";
import { GraphTool } from "../../../components/tools/GraphTool";
import { ImpactTool } from "../../../components/tools/ImpactTool";
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

// Top-level sections. Memory / Decisions / Risks / Sessions live together under
// "Knowledge"; repo connection lives under "Setup" — so the top row stays short.
const TABS = ["Overview", "Knowledge", "Reviews", "Docs", "Tools", "Setup", "Settings"] as const;
type Tab = (typeof TABS)[number];

const SECTION_TABS = TABS.filter((t) => t !== "Settings");

const tabCls = (active: boolean) =>
  cn(
    "-mb-px inline-flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 text-sm transition",
    active
      ? "border-[var(--accent)] text-white"
      : "border-transparent text-[var(--muted)] hover:text-white",
  );

export default function ProjectPage({ params }: { params: Promise<{ workspaceId: string }> }) {
  const { workspaceId } = use(params);
  return (
    <AppShell>
      <Project workspaceId={workspaceId} />
    </AppShell>
  );
}

function Project({ workspaceId }: { workspaceId: string }) {
  const searchParams = useSearchParams();
  const initialTab = TABS.find((t) => t === searchParams.get("tab")) ?? "Overview";
  const [tab, setTab] = useState<Tab>(initialTab);
  const [repoFilter, setRepoFilter] = useState("");
  const { workspaces, setActiveId } = useActiveWorkspace();
  const role = workspaces.find((w) => w.id === workspaceId)?.role;
  const isOwner = role === "owner";

  useEffect(() => setActiveId(workspaceId), [workspaceId, setActiveId]);

  const { data: ws } = useQuery({
    queryKey: ["workspace", workspaceId],
    queryFn: () => api<WorkspaceDetail>(`/workspaces/${workspaceId}`),
  });

  const repos = ws?.repos ?? [];
  // The cross-repo filter lives on the sections that actually span repos.
  const showRepoFilter = ["Knowledge", "Docs"].includes(tab) && repos.length > 1;

  const color = projectColor(workspaceId).color;
  const pending = ws?.pendingMemories ?? 0;

  return (
    <div>
      <header className="sticky top-0 z-20 -mx-8 -mt-8 mb-6 border-b border-[var(--border)] bg-[var(--background)]/90 px-8 backdrop-blur">
        <div className="flex items-stretch gap-6">
          <div className="flex shrink-0 items-center gap-2.5 py-3.5">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: color, boxShadow: `0 0 12px ${color}` }}
              aria-hidden
            />
            <h1 className="font-display whitespace-nowrap text-base font-semibold tracking-tight">
              {ws?.name ?? "Project"}
            </h1>
            <span className="hidden whitespace-nowrap text-xs text-[var(--muted)] sm:inline">
              {repos.length} repo{repos.length === 1 ? "" : "s"} · {role ?? "member"}
            </span>
          </div>

          <nav className="flex min-w-0 flex-1 items-stretch gap-1 overflow-x-auto">
            {SECTION_TABS.map((t) => (
              <button key={t} onClick={() => setTab(t)} className={tabCls(t === tab)}>
                {t}
                {t === "Knowledge" && pending > 0 ? (
                  <span
                    className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--signal-soft)] px-1 text-[10px] font-semibold text-[var(--signal)]"
                    title={`${pending} awaiting review`}
                  >
                    {pending}
                  </span>
                ) : null}
              </button>
            ))}
          </nav>

          <div className="flex shrink-0 items-stretch">
            <button onClick={() => setTab("Settings")} className={tabCls(tab === "Settings")}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" aria-hidden>
                <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
                <path
                  d="M19.4 13a7.8 7.8 0 0 0 0-2l2-1.5-2-3.4-2.4 1a7.8 7.8 0 0 0-1.7-1l-.4-2.6h-3.8l-.4 2.6a7.8 7.8 0 0 0-1.7 1l-2.4-1-2 3.4L4.6 11a7.8 7.8 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7.8 7.8 0 0 0 1.7 1l.4 2.6h3.8l.4-2.6a7.8 7.8 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5Z"
                  stroke="currentColor"
                  strokeWidth="1.4"
                  strokeLinejoin="round"
                />
              </svg>
              Settings
            </button>
          </div>
        </div>
      </header>

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
        {tab === "Overview" ? (
          <Overview ws={ws} workspaceId={workspaceId} onGoto={setTab} />
        ) : null}
        {tab === "Knowledge" ? (
          <KnowledgeTab workspaceId={workspaceId} repoId={repoFilter} repos={repos} pending={pending} />
        ) : null}
        {tab === "Reviews" ? <ReviewsTab workspaceId={workspaceId} /> : null}
        {tab === "Docs" ? <DocsTab workspaceId={workspaceId} repoId={repoFilter} /> : null}
        {tab === "Tools" ? <ToolsTab workspaceId={workspaceId} /> : null}
        {tab === "Setup" ? <SetupTab workspaceId={workspaceId} repos={repos} /> : null}
        {tab === "Settings" ? <ProjectSettings workspaceId={workspaceId} isOwner={isOwner} /> : null}
      </div>
    </div>
  );
}

/* ------------------------------- Overview -------------------------------- */

function Overview({
  ws,
  workspaceId,
  onGoto,
}: {
  ws?: WorkspaceDetail;
  workspaceId: string;
  onGoto: (t: Tab) => void;
}) {
  if (!ws) return <Loading />;
  const totalMemories = ws.repos.reduce((n, r) => n + (r._count?.memories ?? 0), 0);
  const pending = ws.pendingMemories ?? 0;
  const stats: { label: string; value: number; hint?: string; tab?: Tab }[] = [
    { label: "Repos", value: ws.repos.length, tab: "Setup" },
    { label: "Memories", value: totalMemories, tab: "Knowledge" },
    { label: "Awaiting review", value: pending, hint: "in the inbox", tab: "Knowledge" },
    { label: "Members", value: ws.memberships.length, tab: "Settings" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <button
            key={s.label}
            onClick={() => s.tab && onGoto(s.tab)}
            className="text-left"
          >
            <Card hover className="p-5">
              <p className="text-sm text-[var(--muted)]">{s.label}</p>
              <p className="mt-1 text-3xl font-semibold">
                {s.value}
                {s.label === "Awaiting review" && s.value > 0 ? (
                  <span className="ml-2 align-middle text-xs font-normal text-[var(--signal)]">
                    needs you
                  </span>
                ) : null}
              </p>
            </Card>
          </button>
        ))}
      </div>

      {ws.repos.length === 0 ? (
        <EmptyState
          title="No repos connected yet"
          description="Connect a repo to start capturing memory, reviews, and docs."
          action={<Button onClick={() => onGoto("Setup")}>Go to Setup</Button>}
        />
      ) : (
        <ActivityFeed workspaceId={workspaceId} onGoto={onGoto} />
      )}
    </div>
  );
}

type ActivityItem = {
  id: string;
  kind: "memory" | "risk" | "session" | "review";
  title: string;
  meta: string;
  repo: string;
  at: string;
};

function ActivityFeed({ workspaceId, onGoto }: { workspaceId: string; onGoto: (t: Tab) => void }) {
  const memories = useQuery({
    queryKey: ["workspace-memories", workspaceId],
    queryFn: () => api<WorkspaceMemory[]>(`/workspaces/${workspaceId}/memories`),
  });
  const sessions = useQuery({
    queryKey: ["workspace-sessions", workspaceId],
    queryFn: () => api<WsSession[]>(`/workspaces/${workspaceId}/sessions`),
  });
  const reviews = useQuery({
    queryKey: ["workspace-reviews", workspaceId],
    queryFn: () => getWorkspaceReviews(workspaceId),
  });

  const loading = memories.isLoading || sessions.isLoading || reviews.isLoading;

  const items: ActivityItem[] = [
    ...(memories.data ?? []).map((m) => ({
      id: `m-${m.id}`,
      kind: (m.type === "risk" || m.type === "failure" ? "risk" : "memory") as ActivityItem["kind"],
      title: m.title,
      meta: `${m.type} · ${m.status}`,
      repo: m.repoFullName,
      at: m.createdAt,
    })),
    ...(sessions.data ?? []).map((s) => ({
      id: `s-${s.id}`,
      kind: "session" as const,
      title: s.task ?? "Agent session",
      meta: s.agent,
      repo: s.repoFullName,
      at: s.createdAt,
    })),
    ...(reviews.data ?? []).map((r) => ({
      id: `r-${r.id}`,
      kind: "review" as const,
      title: r.prTitle,
      meta: `${r.findingCount} finding${r.findingCount === 1 ? "" : "s"}`,
      repo: r.repoFullName,
      at: r.createdAt,
    })),
  ]
    .sort((a, b) => +new Date(b.at) - +new Date(a.at))
    .slice(0, 14);

  return (
    <Card className="p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-sm font-semibold">Recent activity</h2>
        <button
          onClick={() => onGoto("Knowledge")}
          className="text-xs text-[var(--muted)] transition hover:text-white"
        >
          View knowledge →
        </button>
      </div>
      {loading ? (
        <Loading />
      ) : items.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--muted)]">
          Nothing yet — activity from memory, reviews, and agent sessions shows up here.
        </p>
      ) : (
        <ul className="divide-y divide-[var(--border)]">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-3 py-2.5">
              <ActivityDot kind={it.kind} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">{it.title}</p>
                <p className="text-xs text-[var(--faint)]">
                  {it.meta}
                  {it.repo ? ` · ${it.repo}` : ""}
                </p>
              </div>
              <span className="shrink-0 text-xs text-[var(--faint)]" title={new Date(it.at).toLocaleString()}>
                {timeAgo(it.at)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

const ACTIVITY_COLOR: Record<ActivityItem["kind"], string> = {
  memory: "var(--accent)",
  risk: "var(--alert)",
  session: "var(--accent-cyan)",
  review: "var(--signal)",
};

function ActivityDot({ kind }: { kind: ActivityItem["kind"] }) {
  return (
    <span
      className="mt-1.5 inline-block h-2 w-2 shrink-0 rounded-full"
      style={{ background: ACTIVITY_COLOR[kind], boxShadow: `0 0 8px ${ACTIVITY_COLOR[kind]}` }}
      title={kind}
      aria-hidden
    />
  );
}

/* ------------------------------- Knowledge ------------------------------- */

const KNOWLEDGE_TABS = ["Inbox", "Memory", "Decisions", "Risks", "Sessions"] as const;
type KnowledgeKey = (typeof KNOWLEDGE_TABS)[number];

function KnowledgeTab({
  workspaceId,
  repoId,
  repos,
  pending,
}: {
  workspaceId: string;
  repoId: string;
  repos: WorkspaceDetail["repos"];
  pending: number;
}) {
  const [sub, setSub] = useState<KnowledgeKey>(pending > 0 ? "Inbox" : "Memory");
  return (
    <div>
      <nav className="-mt-2 mb-6 flex items-stretch gap-1 overflow-x-auto border-b border-[var(--border)]">
        {KNOWLEDGE_TABS.map((t) => (
          <button key={t} onClick={() => setSub(t)} className={cn(tabCls(sub === t), "py-2.5")}>
            {t}
            {t === "Inbox" && pending > 0 ? (
              <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--signal-soft)] px-1 text-[10px] font-semibold text-[var(--signal)]">
                {pending}
              </span>
            ) : null}
          </button>
        ))}
      </nav>
      {sub === "Inbox" ? <InboxTab workspaceId={workspaceId} repoId={repoId} /> : null}
      {sub === "Memory" ? <MemoryTab workspaceId={workspaceId} repoId={repoId} /> : null}
      {sub === "Decisions" ? (
        <DecisionsTab workspaceId={workspaceId} repoId={repoId} repos={repos} />
      ) : null}
      {sub === "Risks" ? <RisksTab workspaceId={workspaceId} repoId={repoId} repos={repos} /> : null}
      {sub === "Sessions" ? <SessionsTab workspaceId={workspaceId} repoId={repoId} /> : null}
    </div>
  );
}

/** The review queue — proposed memories across the project, approve/reject inline. */
function InboxTab({ workspaceId, repoId }: { workspaceId: string; repoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-memories", workspaceId, "", "proposed", ""],
    queryFn: () => api<WorkspaceMemory[]>(`/workspaces/${workspaceId}/memories?status=proposed`),
  });
  const memories = sortMemories(
    (data ?? []).filter((m) => !repoId || m.repoId === repoId),
    "confidence",
  );
  const { pageItems, page, setPage, totalPages, total } = usePagination(memories);
  return (
    <div>
      <p className="mb-4 text-sm text-[var(--muted)]">
        Proposed memories awaiting review. Approve to make them retrievable by agents, or reject.
      </p>
      <MemoryList
        memories={pageItems}
        isLoading={isLoading}
        empty="Inbox zero — nothing awaiting review."
      />
      <Pagination page={page} totalPages={totalPages} total={total} onPage={setPage} label="proposed" />
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

function RisksTab({
  workspaceId,
  repoId,
  repos,
}: {
  workspaceId: string;
  repoId: string;
  repos: WorkspaceDetail["repos"];
}) {
  const qc = useQueryClient();
  const [sort, setSort] = useState<MemorySort>("recent");
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [pickRepo, setPickRepo] = useState(repos[0]?.id ?? "");
  const targetRepo = repoId || pickRepo;

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

  const record = useMutation({
    mutationFn: () =>
      api(`/repos/${targetRepo}/memories`, {
        method: "POST",
        body: JSON.stringify({
          type: "risk",
          title: title.trim().slice(0, 140),
          content: detail.trim() || title.trim(),
          status: "approved",
          source: "manual",
          confidence: 0.8,
        }),
      }),
    onSuccess: () => {
      setTitle("");
      setDetail("");
      setAdding(false);
      qc.invalidateQueries({ queryKey: ["workspace-memories"] });
    },
  });

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <Button variant={adding ? "ghost" : "primary"} size="sm" onClick={() => setAdding((v) => !v)}>
          {adding ? "Cancel" : "Record a risk"}
        </Button>
        <Select value={sort} onChange={(e) => setSort(e.target.value as MemorySort)} title="Sort">
          <option value="recent">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="confidence">Confidence</option>
        </Select>
      </div>

      {adding ? (
        <Card className="mb-4 p-5">
          <h3 className="font-semibold">Record a risk</h3>
          <p className="mt-1 text-sm text-[var(--muted)]">
            A known danger or past failure agents should be warned about before touching related code.
          </p>
          <div className="mt-3 space-y-3">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Webhook handler must stay idempotent — double-charges otherwise"
            />
            <Textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              placeholder="Details / how to avoid it (optional)"
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
                disabled={!title.trim() || !targetRepo}
                loading={record.isPending}
              >
                Save risk
              </Button>
            </div>
          </div>
        </Card>
      ) : null}

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

/* -------------------------------- Reviews -------------------------------- */

const REVIEW_SEVERITY_COLOR: Record<string, string> = {
  blocker: "var(--alert)",
  warning: "var(--signal)",
  nit: "var(--accent)",
  praise: "var(--verify)",
};

function ReviewsTab({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ["workspace-reviews", workspaceId],
    queryFn: () => getWorkspaceReviews(workspaceId),
  });

  if (isLoading) return <Loading />;
  if (isError)
    return (
      <Card className="border-[var(--alert)]/40 p-4">
        <p className="text-sm text-[var(--alert)]">
          Couldn&apos;t load reviews: {(error as Error).message}
        </p>
      </Card>
    );

  const reviews = data ?? [];
  if (reviews.length === 0)
    return (
      <EmptyState
        title="No PR reviews yet"
        description="When the memory-grounded reviewer runs on a pull request, its reviews land here. Enable it per repo in Setup, then open a PR."
      />
    );

  return (
    <div className="space-y-3">
      <p className="text-sm text-[var(--muted)]">
        Memory-grounded PR reviews across every repo. Open one to accept or dismiss findings — your
        feedback tunes the confidence of the memory that grounded it.
      </p>
      {reviews.map((r) => {
        const pending = r.findings.filter((f) => f.feedback === "pending").length;
        return (
          <Link key={r.id} href={`/repos/${r.repoId}/reviews`}>
            <Card hover className="p-4">
              <div className="flex items-center justify-between gap-3">
                <h3 className="min-w-0 truncate font-medium">
                  {r.prNumber ? <span className="text-[var(--faint)]">#{r.prNumber} </span> : null}
                  {r.prTitle}
                </h3>
                <span className="shrink-0 text-xs text-[var(--faint)]">{timeAgo(r.createdAt)}</span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-[var(--muted)]">
                <span>{r.repoFullName}</span>
                <span>·</span>
                <span className="flex items-center gap-1.5">
                  {(["blocker", "warning", "nit", "praise"] as const).map((sev) => {
                    const n = r.findings.filter((f) => f.severity === sev).length;
                    if (!n) return null;
                    return (
                      <span key={sev} className="inline-flex items-center gap-1">
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ background: REVIEW_SEVERITY_COLOR[sev] }}
                        />
                        {n}
                      </span>
                    );
                  })}
                  {r.findingCount === 0 ? "clean" : null}
                </span>
                {pending > 0 ? (
                  <span
                    className="rounded-full px-2 py-0.5 font-medium"
                    style={{ background: "var(--signal-soft)", color: "var(--signal)" }}
                  >
                    {pending} to review
                  </span>
                ) : null}
              </div>
            </Card>
          </Link>
        );
      })}
    </div>
  );
}

/* --------------------------------- Docs ---------------------------------- */

function DocsTab({ workspaceId, repoId }: { workspaceId: string; repoId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["workspace-docs", workspaceId],
    queryFn: () => api<WsDoc[]>(`/workspaces/${workspaceId}/docs`),
  });
  const docs = (data ?? []).filter((d) => !repoId || d.repoId === repoId);
  const { pageItems, page, setPage, totalPages, total } = usePagination(docs);
  if (isLoading) return <Loading />;
  if (docs.length === 0)
    return (
      <Card className="max-w-2xl p-6">
        <h2 className="font-display font-semibold">No docs yet</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Living docs — Overview, Commands, Risks, and Onboarding — are generated from a repo&apos;s
          approved memories. Once a repo has approved memories, generate them from the repo&apos;s{" "}
          <span className="text-[var(--text)]">Docs</span> tab, or from the CLI:
        </p>
        <div className="mt-4">
          <Code>{`cortex scan          # propose starter memories from the repo
# approve a few in the inbox, then in the repo's Docs tab:
#   Generate living docs`}</Code>
        </div>
        <p className="mt-3 text-xs text-[var(--faint)]">
          Approved memories in → structured, always-current docs out.
        </p>
      </Card>
    );
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

/* --------------------------------- Tools --------------------------------- */

const TOOL_TABS = ["Search", "Chat", "Graph", "Impact"] as const;
type ToolKey = (typeof TOOL_TABS)[number];

function ToolsTab({ workspaceId }: { workspaceId: string }) {
  const [sub, setSub] = useState<ToolKey>("Search");
  return (
    <div>
      <nav className="-mt-2 mb-6 flex items-stretch gap-1 overflow-x-auto border-b border-[var(--border)]">
        {TOOL_TABS.map((t) => (
          <button key={t} onClick={() => setSub(t)} className={cn(tabCls(sub === t), "py-2.5")}>
            {t}
          </button>
        ))}
      </nav>
      {sub === "Search" ? <SearchTool workspaceId={workspaceId} /> : null}
      {sub === "Chat" ? <ChatTool workspaceId={workspaceId} /> : null}
      {sub === "Graph" ? <GraphTool workspaceId={workspaceId} /> : null}
      {sub === "Impact" ? <ImpactTool workspaceId={workspaceId} /> : null}
    </div>
  );
}

/* --------------------------------- Setup --------------------------------- */

function SetupTab({
  workspaceId,
  repos,
}: {
  workspaceId: string;
  repos: WorkspaceDetail["repos"];
}) {
  const [adding, setAdding] = useState(false);
  const [drawerRepo, setDrawerRepo] = useState<string | null>(null);
  const connected = repos.length > 0;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Connection status — surfaced first so an operator sees state at a glance. */}
      <Card className="p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  background: connected ? "var(--verify)" : "var(--faint)",
                  boxShadow: connected ? "0 0 10px var(--verify)" : "none",
                }}
              />
              <h2 className="font-display font-semibold">
                {connected ? "Connected" : "Not connected yet"}
              </h2>
            </div>
            <p className="mt-1 text-sm text-[var(--muted)]">
              {connected
                ? `${repos.length} repo${repos.length === 1 ? "" : "s"} linked to this project.`
                : "Link your first repo to start capturing memory and reviews."}
            </p>
          </div>
          <Button variant={connected ? "ghost" : "primary"} onClick={() => setAdding((v) => !v)}>
            {adding ? "Cancel" : "Add repo"}
          </Button>
        </div>

        {adding ? (
          <div className="mt-4 border-t border-[var(--border)] pt-4">
            <RepoPicker workspaceId={workspaceId} onCreated={() => setAdding(false)} />
          </div>
        ) : null}

        {connected ? (
          <div className="mt-4 divide-y divide-[var(--border)] border-t border-[var(--border)]">
            {repos.map((r) => (
              <button
                key={r.id}
                onClick={() => setDrawerRepo(r.id)}
                className="group flex w-full items-center justify-between py-2.5 text-left"
              >
                <span className="flex items-center gap-2 text-sm">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ background: "var(--verify)" }}
                  />
                  <span className="transition group-hover:text-[var(--accent)]">{r.fullName}</span>
                </span>
                <span className="text-xs text-[var(--faint)] transition group-hover:text-[var(--muted)]">
                  {r._count?.memories ?? 0} memories · set up →
                </span>
              </button>
            ))}
          </div>
        ) : null}
      </Card>

      {/* Install / connect instructions. */}
      <Card className="p-6">
        <h2 className="font-display font-semibold">Connect Claude Code</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Install the CLI once, then open a repo above to get its <code className="text-[var(--text)]">cortex init</code>{" "}
          command. Full reference in{" "}
          <Link href="/docs" className="text-[var(--accent)] hover:underline">
            Documentation
          </Link>
          .
        </p>
        <div className="mt-4">
          <Code label="shell">{`npm install -g @mxbenjaminbeguin/cortex
cortex login
cortex status    # verify the connection`}</Code>
        </div>
        <p className="mt-3 text-xs text-[var(--faint)]">
          Select a repo above to connect it and toggle its PR reviewer — right in a drawer.
        </p>
      </Card>

      {drawerRepo ? (
        <RepoSetupDrawer
          repoId={drawerRepo}
          fullName={repos.find((r) => r.id === drawerRepo)?.fullName}
          onClose={() => setDrawerRepo(null)}
        />
      ) : null}
    </div>
  );
}

function Loading() {
  return (
    <p className="flex items-center gap-2 text-[var(--muted)]">
      <Spinner /> Loading…
    </p>
  );
}
