"use client";

import { use, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  type AgentSessionSummary,
  type PullRequest,
  type ReviewResult,
  type ReviewerSkill,
} from "../../../lib/api";
import { AppShell } from "../../../components/AppShell";
import { RepoNav } from "../../../components/RepoNav";
import { Button, Card, Code, Input, Textarea } from "../../../components/ui";

interface RepoDetail {
  id: string;
  workspaceId: string;
  fullName: string;
  provider: string;
  stack: string[];
  packageManager: string | null;
  notes: string | null;
  reviewerEnabled?: boolean;
  reviewerInstructions?: string | null;
  reviewerSkillIds?: string[];
  workspace?: { name: string };
  memoryCounts: { status: string; _count: number }[];
  viewerRole?: string;
}

export default function RepoPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <RepoOverview repoId={repoId} />
    </AppShell>
  );
}

function RepoOverview({ repoId }: { repoId: string }) {
  const { data: repo, isLoading } = useQuery({
    queryKey: ["repo", repoId],
    queryFn: () => api<RepoDetail>(`/repos/${repoId}`),
  });

  if (isLoading) return <p className="text-[var(--muted)]">Loading…</p>;
  if (!repo) return <p className="text-[var(--muted)]">Repo not found.</p>;

  const count = (status: string) =>
    repo.memoryCounts.find((c) => c.status === status)?._count ?? 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold">{repo.fullName}</h1>
      <p className="text-sm text-[var(--muted)]">{repo.workspace?.name}</p>

      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Stat label="Approved" value={count("approved")} />
        <Stat label="Proposed (inbox)" value={count("proposed")} href={`/repos/${repoId}/inbox`} />
        <Stat label="Archived" value={count("archived")} />
      </div>

      <ScanCard repoId={repoId} />

      <ReviewerCard repo={repo} repoId={repoId} />

      <RepoContextCard repo={repo} repoId={repoId} />

      <SessionsPanel repoId={repoId} />

      <div className="mt-6 flex gap-3 text-sm">
        <Link href={`/repos/${repoId}/memories`} className="text-[var(--accent)]">
          Browse memory library →
        </Link>
        <Link href={`/repos/${repoId}/setup`} className="text-[var(--accent)]">
          Connect Claude Code →
        </Link>
      </div>

      {repo.viewerRole === "owner" ? (
        <DangerZone repoId={repoId} fullName={repo.fullName} />
      ) : null}
    </div>
  );
}

function ScanCard({ repoId }: { repoId: string }) {
  const qc = useQueryClient();
  const scan = useMutation({
    mutationFn: () => api<{ proposedCount: number }>(`/repos/${repoId}/scan`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["repo", repoId] });
      qc.invalidateQueries({ queryKey: ["memories", repoId] });
    },
  });
  const notConnected = scan.isError && (scan.error as Error).message === "github_not_connected";

  return (
    <Card className="mt-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Bootstrap from codebase</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Scan the repo&apos;s README, manifest, and structure to propose starter memories —
            architecture, commands, conventions, risks — for review in the inbox. Uses this
            workspace&apos;s Anthropic key (Settings), or a heuristic fallback.
          </p>
          <p className="mt-2 text-xs text-[var(--muted)]">
            No key? Run <code>cortex scan</code> in your repo — it drives your local Claude Code to
            read the codebase and propose memories on <em>your</em> Claude subscription (no API key).
          </p>
        </div>
        <Button onClick={() => scan.mutate()} disabled={scan.isPending}>
          {scan.isPending ? "Scanning…" : "Scan codebase"}
        </Button>
      </div>
      {scan.isSuccess ? (
        <p className="mt-3 text-sm text-emerald-300">
          Created {scan.data.proposedCount} proposed{" "}
          {scan.data.proposedCount === 1 ? "memory" : "memories"}.{" "}
          <Link href={`/repos/${repoId}/inbox`} className="underline">
            Review in inbox →
          </Link>
        </p>
      ) : notConnected ? (
        <p className="mt-3 text-sm text-yellow-300">
          Connect GitHub in{" "}
          <Link href="/settings" className="underline">
            settings
          </Link>{" "}
          to scan.
        </p>
      ) : scan.isError ? (
        <p className="mt-3 text-sm text-red-400">{(scan.error as Error).message}</p>
      ) : null}
    </Card>
  );
}

const SEVERITY_STYLE: Record<string, string> = {
  blocker: "bg-red-500/15 text-red-300 border-red-500/30",
  warning: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  nit: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  praise: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
};

function reviewErr(msg: string): string {
  if (msg === "llm_not_configured")
    return "Add an Anthropic key in the project's Settings → AI key to run the reviewer.";
  if (msg === "github_not_connected") return "Connect GitHub in settings to review PRs.";
  return msg;
}

function ReviewerCard({ repo, repoId }: { repo: RepoDetail; repoId: string }) {
  const qc = useQueryClient();
  const [enabled, setEnabled] = useState(!!repo.reviewerEnabled);
  const [instructions, setInstructions] = useState(repo.reviewerInstructions ?? "");
  const [reviews, setReviews] = useState<Record<number, ReviewResult>>({});

  const save = useMutation({
    mutationFn: () =>
      api(`/repos/${repoId}`, {
        method: "PATCH",
        body: JSON.stringify({ reviewerEnabled: enabled, reviewerInstructions: instructions.trim() }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repo", repoId] }),
  });

  const { data: pulls, isLoading, error } = useQuery({
    queryKey: ["pulls", repoId],
    queryFn: () => api<PullRequest[]>(`/repos/${repoId}/pulls`),
    retry: false,
  });
  const ghNotConnected = (error as Error | undefined)?.message === "github_not_connected";

  const review = useMutation({
    mutationFn: (vars: { prNumber: number; post?: boolean }) =>
      api<ReviewResult>(`/repos/${repoId}/review`, { method: "POST", body: JSON.stringify(vars) }),
    onSuccess: (data, vars) => setReviews((m) => ({ ...m, [vars.prNumber]: data })),
  });
  const busyPr = review.isPending ? review.variables?.prNumber : undefined;

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold">PR Reviewer</h2>
        <label className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-4 w-4 accent-[var(--accent)]"
          />
          Enable in CI
        </label>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Reviews pull requests grounded in this repo&apos;s approved memories — rules, risks, and past
        failures. Run it automatically in CI (a GitHub Action posts the review on every PR), or review
        on demand below. The CI toggle above is the kill-switch. Uses this workspace&apos;s Anthropic
        key (project Settings).
      </p>

      <details className="mt-3 text-xs text-[var(--muted)]">
        <summary className="cursor-pointer hover:text-white">Set up CI (GitHub Actions)</summary>
        <div className="mt-2 space-y-2">
          <p>In your repo, generate the workflow and add your Cortex token as a secret:</p>
          <Code>{`cortex ci                        # writes .github/workflows/cortex-review.yml
gh secret set CORTEX_TOKEN       # your token from \`cortex login\`
# self-hosting the API? also:
gh variable set CORTEX_API_URL --body https://your-cortex-api`}</Code>
          <p>
            The Action computes the PR diff, asks Cortex for a memory-grounded review, and posts it
            with the repo&apos;s built-in token. Toggle &ldquo;Enable in CI&rdquo; off to pause it.
          </p>
        </div>
      </details>

      <label className="mt-4 block">
        <span className="text-xs text-[var(--muted)]">Reviewer instructions (optional)</span>
        <Textarea
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={2}
          placeholder="e.g. Be strict about test coverage and DB migrations; flag any change under src/billing/**."
          className="mt-1"
        />
      </label>
      <div className="mt-3 flex items-center gap-2">
        <Button onClick={() => save.mutate()} loading={save.isPending}>
          Save reviewer settings
        </Button>
        {save.isSuccess ? <span className="text-xs text-emerald-300">Saved.</span> : null}
      </div>

      <ReviewerSkills
        workspaceId={repo.workspaceId}
        repoId={repoId}
        attachedIds={repo.reviewerSkillIds ?? []}
      />

      <div className="mt-6 border-t border-[var(--border)] pt-4">
        <h3 className="text-sm font-semibold">Open pull requests</h3>
        {ghNotConnected ? (
          <p className="mt-2 text-sm text-yellow-300">
            Connect GitHub in{" "}
            <Link href="/settings" className="underline">
              settings
            </Link>{" "}
            to review PRs.
          </p>
        ) : isLoading ? (
          <p className="mt-2 text-sm text-[var(--muted)]">Loading…</p>
        ) : !pulls || pulls.length === 0 ? (
          <p className="mt-2 text-sm text-[var(--muted)]">No open pull requests.</p>
        ) : (
          <ul className="mt-3 space-y-4">
            {pulls.map((p) => {
              const result = reviews[p.number];
              const reviewing = busyPr === p.number && !review.variables?.post;
              return (
                <li key={p.number} className="rounded-lg border border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium hover:text-[var(--accent)]"
                      >
                        #{p.number} {p.title}
                      </a>
                      <p className="text-xs text-[var(--muted)]">
                        {p.author ?? "unknown"} · updated {new Date(p.updatedAt).toLocaleDateString()}
                        {p.draft ? " · draft" : ""}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      onClick={() => review.mutate({ prNumber: p.number })}
                      disabled={busyPr === p.number}
                    >
                      {reviewing ? "Reviewing…" : result ? "Re-review" : "Review"}
                    </Button>
                  </div>
                  {result ? (
                    <ReviewResultView
                      result={result}
                      posting={busyPr === p.number && !!review.variables?.post}
                      onPost={() => review.mutate({ prNumber: p.number, post: true })}
                    />
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {review.isError ? (
          <p className="mt-3 text-sm text-red-400">{reviewErr((review.error as Error).message)}</p>
        ) : null}
      </div>
    </Card>
  );
}

function ReviewerSkills({
  workspaceId,
  repoId,
  attachedIds,
}: {
  workspaceId: string;
  repoId: string;
  attachedIds: string[];
}) {
  const qc = useQueryClient();
  const [attached, setAttached] = useState<string[]>(attachedIds);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [instructions, setInstructions] = useState("");
  const [paths, setPaths] = useState("");

  const { data: skills } = useQuery({
    queryKey: ["reviewer-skills", workspaceId],
    queryFn: () => api<ReviewerSkill[]>(`/workspaces/${workspaceId}/reviewer-skills`),
  });

  const setSkills = useMutation({
    mutationFn: (ids: string[]) =>
      api(`/repos/${repoId}/reviewer-skills`, { method: "PUT", body: JSON.stringify({ skillIds: ids }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repo", repoId] }),
  });

  function toggle(id: string) {
    const next = attached.includes(id) ? attached.filter((x) => x !== id) : [...attached, id];
    setAttached(next);
    setSkills.mutate(next);
  }

  const create = useMutation({
    mutationFn: () =>
      api<ReviewerSkill>(`/workspaces/${workspaceId}/reviewer-skills`, {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          instructions: instructions.trim(),
          paths: paths.split(",").map((p) => p.trim()).filter(Boolean),
        }),
      }),
    onSuccess: () => {
      setName("");
      setInstructions("");
      setPaths("");
      setCreating(false);
      qc.invalidateQueries({ queryKey: ["reviewer-skills", workspaceId] });
    },
  });

  const del = useMutation({
    mutationFn: (id: string) => api(`/reviewer-skills/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviewer-skills", workspaceId] });
      qc.invalidateQueries({ queryKey: ["repo", repoId] });
    },
  });

  return (
    <div className="mt-6 border-t border-[var(--border)] pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Reviewer skills</h3>
        <button
          onClick={() => setCreating((v) => !v)}
          className="text-xs text-[var(--muted)] hover:text-white"
        >
          {creating ? "Cancel" : "+ New skill"}
        </button>
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Reusable, named instruction sets shared across this project&apos;s repos. Check the ones this
        repo&apos;s reviewer should apply.
      </p>

      {creating ? (
        <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-3">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Skill name (e.g. Migration safety)" />
          <Textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            rows={3}
            placeholder="Instructions — what this skill makes the reviewer check."
          />
          <Input
            value={paths}
            onChange={(e) => setPaths(e.target.value)}
            placeholder="Optional path scope, comma-separated (e.g. prisma/**, **/migrations/**)"
          />
          <Button
            onClick={() => create.mutate()}
            disabled={!name.trim() || !instructions.trim()}
            loading={create.isPending}
          >
            Create skill
          </Button>
          {create.isError ? (
            <p className="text-xs text-red-400">{(create.error as Error).message}</p>
          ) : null}
        </div>
      ) : null}

      {!skills || skills.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">No skills yet. Create one to get started.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {skills.map((s) => (
            <li
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-lg border border-[var(--border)] p-3"
            >
              <label className="flex min-w-0 items-start gap-2.5">
                <input
                  type="checkbox"
                  checked={attached.includes(s.id)}
                  onChange={() => toggle(s.id)}
                  className="mt-0.5 h-4 w-4 accent-[var(--accent)]"
                />
                <span className="min-w-0">
                  <span className="text-sm font-medium">{s.name}</span>
                  {s.paths.length > 0 ? (
                    <span className="ml-2 font-mono text-[10px] text-cyan-200">
                      {s.paths.join(", ")}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block line-clamp-2 text-xs text-[var(--muted)]">
                    {s.instructions}
                  </span>
                </span>
              </label>
              <button
                onClick={() => del.mutate(s.id)}
                title="Delete skill"
                className="shrink-0 text-xs text-[var(--muted)] hover:text-red-400"
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ReviewResultView({
  result,
  posting,
  onPost,
}: {
  result: ReviewResult;
  posting: boolean;
  onPost: () => void;
}) {
  return (
    <div className="mt-3 rounded-lg bg-[var(--surface-2)] p-3">
      <p className="text-sm">{result.review.summary}</p>
      {result.review.findings.length > 0 ? (
        <ul className="mt-2 space-y-2">
          {result.review.findings.map((f, i) => (
            <li key={i} className="text-sm">
              <span className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${
                    SEVERITY_STYLE[f.severity] ?? "border-white/10 text-[var(--muted)]"
                  }`}
                >
                  {f.severity}
                </span>
                <span className="font-medium">{f.title}</span>
                {f.path ? (
                  <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-cyan-200">
                    {f.path}
                    {f.line ? `:${f.line}` : ""}
                  </code>
                ) : null}
              </span>
              <p className="mt-0.5 text-xs text-[var(--muted)]">
                {f.detail}
                {f.memory ? <span className="text-[var(--faint)]"> · memory: {f.memory}</span> : null}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-[var(--muted)]">No issues flagged.</p>
      )}
      <div className="mt-3">
        {result.posted ? (
          <span className="text-xs text-emerald-300">Posted to PR ✓</span>
        ) : (
          <Button size="sm" variant="ghost" onClick={onPost} disabled={posting}>
            {posting ? "Posting…" : "Post to PR"}
          </Button>
        )}
      </div>
    </div>
  );
}

function RepoContextCard({ repo, repoId }: { repo: RepoDetail; repoId: string }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [stack, setStack] = useState(repo.stack.join(", "));
  const [packageManager, setPackageManager] = useState(repo.packageManager ?? "");
  const [notes, setNotes] = useState(repo.notes ?? "");

  const save = useMutation({
    mutationFn: () =>
      api(`/repos/${repoId}`, {
        method: "PATCH",
        body: JSON.stringify({
          stack: stack
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          packageManager: packageManager.trim(),
          notes: notes.trim(),
        }),
      }),
    onSuccess: () => {
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["repo", repoId] });
    },
  });

  const resync = useMutation({
    mutationFn: () => api(`/repos/${repoId}/resync`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["repo", repoId] }),
  });
  const notConnected =
    resync.isError && (resync.error as Error).message === "github_not_connected";

  return (
    <Card className="mt-6 p-6">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Repo context</h2>
        {!editing ? (
          <div className="flex items-center gap-3 text-xs">
            <button
              onClick={() => resync.mutate()}
              disabled={resync.isPending}
              className="text-[var(--muted)] hover:text-white disabled:opacity-50"
            >
              {resync.isPending ? "Resyncing…" : "↻ Resync from GitHub"}
            </button>
            <button onClick={() => setEditing(true)} className="text-[var(--muted)] hover:text-white">
              Edit
            </button>
          </div>
        ) : null}
      </div>
      <p className="mt-1 text-xs text-[var(--muted)]">
        Used by <code>get_repo_context</code> and the generated docs.
      </p>
      {notConnected ? (
        <p className="mt-2 text-xs text-yellow-300">
          Connect GitHub in{" "}
          <Link href="/settings" className="underline">
            settings
          </Link>{" "}
          to resync.
        </p>
      ) : resync.isError ? (
        <p className="mt-2 text-xs text-red-400">{(resync.error as Error).message}</p>
      ) : resync.isSuccess ? (
        <p className="mt-2 text-xs text-emerald-300">Synced stack &amp; branch from GitHub.</p>
      ) : null}

      {editing ? (
        <div className="mt-4 space-y-3 text-sm">
          <Field label="Stack (comma-separated)">
            <input
              value={stack}
              onChange={(e) => setStack(e.target.value)}
              placeholder="Node.js, PostgreSQL, Redis"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </Field>
          <Field label="Package manager">
            <input
              value={packageManager}
              onChange={(e) => setPackageManager(e.target.value)}
              placeholder="pnpm"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </Field>
          <Field label="Notes">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="What this repo does, conventions, anything agents should know."
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 outline-none focus:border-[var(--accent)]"
            />
          </Field>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setStack(repo.stack.join(", "));
                setPackageManager(repo.packageManager ?? "");
                setNotes(repo.notes ?? "");
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <dl className="mt-4 space-y-2 text-sm">
          <Row label="Stack" value={repo.stack.join(", ") || "—"} />
          <Row label="Package manager" value={repo.packageManager ?? "—"} />
          <Row label="Notes" value={repo.notes ?? "—"} />
        </dl>
      )}
    </Card>
  );
}

function DangerZone({ repoId, fullName }: { repoId: string; fullName: string }) {
  const router = useRouter();
  const remove = useMutation({
    mutationFn: () => api(`/repos/${repoId}`, { method: "DELETE" }),
    onSuccess: () => router.push("/dashboard"),
  });

  return (
    <Card className="mt-8 border-red-500/30 p-6">
      <h2 className="font-semibold text-red-300">Danger zone</h2>
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="text-sm text-[var(--muted)]">
          Disconnect <strong>{fullName}</strong> and permanently delete its memories, sessions, and
          docs. This cannot be undone.
        </p>
        <Button
          variant="danger"
          disabled={remove.isPending}
          onClick={() => {
            if (window.confirm(`Disconnect ${fullName}? This deletes all its memory and cannot be undone.`)) {
              remove.mutate();
            }
          }}
        >
          {remove.isPending ? "Disconnecting…" : "Disconnect repo"}
        </Button>
      </div>
      {remove.isError ? (
        <p className="mt-2 text-sm text-red-400">{(remove.error as Error).message}</p>
      ) : null}
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs text-[var(--muted)]">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function SessionsPanel({ repoId }: { repoId: string }) {
  const { data: sessions } = useQuery({
    queryKey: ["sessions", repoId],
    queryFn: () => api<AgentSessionSummary[]>(`/repos/${repoId}/sessions`),
  });
  return (
    <Card className="mt-6 p-6">
      <h2 className="font-semibold">Recent agent sessions</h2>
      {!sessions || sessions.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--muted)]">
          No sessions yet. Claude Code records them via{" "}
          <code>record_session_summary</code>; proposals land in your inbox.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {sessions.map((s) => (
            <li key={s.id} className="flex items-start justify-between gap-4 border-b border-[var(--border)] pb-3 last:border-0">
              <div>
                <p className="text-sm">{s.task ?? "Untitled session"}</p>
                {s.summary ? (
                  <p className="mt-0.5 line-clamp-2 text-xs text-[var(--muted)]">{s.summary}</p>
                ) : null}
              </div>
              <span className="whitespace-nowrap text-xs text-[var(--muted)]">
                {new Date(s.createdAt).toLocaleDateString()} · {s.agent}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Stat({ label, value, href }: { label: string; value: number; href?: string }) {
  const inner = (
    <Card className="p-5">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-3xl font-semibold">{value}</p>
    </Card>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd className="text-right">{value}</dd>
    </div>
  );
}
