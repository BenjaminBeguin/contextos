"use client";

import { use, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PrReviewDTO, PrReviewFindingDTO, ReviewFeedback, ReviewSeverity } from "@memmo/shared";
import {
  getReviews,
  sendFindingFeedback,
  timeAgo,
  type FindingFeedbackResult,
} from "../../../../lib/api";
import { AppShell } from "../../../../components/AppShell";
import { RepoNav } from "../../../../components/RepoNav";
import { cn, EmptyState, PageHeader, Skeleton } from "../../../../components/ui";

export default function ReviewsPage({ params }: { params: Promise<{ repoId: string }> }) {
  const { repoId } = use(params);
  return (
    <AppShell>
      <RepoNav repoId={repoId} />
      <Reviews repoId={repoId} />
    </AppShell>
  );
}

type ReviewsResponse = { reviews: PrReviewDTO[]; total: number };

/** Amber "signal fired" record: a finding's feedback moved its memory's confidence. */
type Fired = { memoryId: string; from: number; to: number };

function Reviews({ repoId }: { repoId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["reviews", repoId] as const;

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: () => getReviews(repoId, { limit: 50 }),
  });

  // Which reviews are expanded. Auto-open the newest one once loaded.
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const initialized = useRef(false);
  useEffect(() => {
    if (!initialized.current && data?.reviews?.length) {
      initialized.current = true;
      setOpen({ [data.reviews[0]!.id]: true });
    }
  }, [data]);

  // Per-finding "signal fired" affordance, keyed by finding id.
  const [fired, setFired] = useState<Record<string, Fired>>({});
  // The finding currently awaiting a feedback response (disables its buttons).
  const [pendingId, setPendingId] = useState<string | null>(null);

  const feedback = useMutation({
    mutationFn: ({ findingId, next }: { findingId: string; next: ReviewFeedback }) =>
      sendFindingFeedback(findingId, next),
    onMutate: ({ findingId }) => setPendingId(findingId),
    onSuccess: (result: FindingFeedbackResult) => {
      const updated = result.finding;
      // Reflect the returned feedback state in the cached reviews.
      queryClient.setQueryData<ReviewsResponse>(queryKey, (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          reviews: prev.reviews.map((r) => ({
            ...r,
            findings: r.findings.map((f) => (f.id === updated.id ? { ...f, ...updated } : f)),
          })),
        };
      });
      // Surface the confidence movement, if the grounding memory changed.
      setFired((prevFired) => {
        const nextFired = { ...prevFired };
        if (result.memory && result.memory.confidence !== result.memory.previousConfidence) {
          nextFired[updated.id] = {
            memoryId: result.memory.id,
            from: result.memory.previousConfidence,
            to: result.memory.confidence,
          };
        } else {
          delete nextFired[updated.id];
        }
        return nextFired;
      });
    },
    onSettled: () => setPendingId(null),
  });

  function mark(finding: PrReviewFindingDTO, target: Exclude<ReviewFeedback, "pending">) {
    // Toggling the already-chosen state returns the finding to pending.
    const next: ReviewFeedback = finding.feedback === target ? "pending" : target;
    feedback.mutate({ findingId: finding.id, next });
  }

  const reviews = data?.reviews ?? [];

  return (
    <div>
      <PageHeader
        title="Reviews"
        description={
          <>
            Persisted PR reviews grounded in this repo&rsquo;s approved memories. Accept or dismiss a
            finding to feed the signal back into the confidence of the memory that grounded it.
          </>
        }
      />

      {isLoading ? (
        <div className="space-y-4">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : isError ? (
        <div className="rounded-xl border border-[var(--alert)]/30 bg-[var(--alert)]/5 p-5 text-sm text-[var(--alert)]">
          {(error as Error)?.message ?? "Failed to load reviews."}
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M4 5.5A1.5 1.5 0 0 1 5.5 4h13A1.5 1.5 0 0 1 20 5.5v9A1.5 1.5 0 0 1 18.5 16H9l-5 4V5.5Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path d="M8 9h8M8 12h5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          }
          title="No reviews yet"
          description="When the PR Reviewer runs on this repo (via CI, GitHub, or the CLI), each review is persisted here so you can accept or dismiss its findings."
        />
      ) : (
        <div className="space-y-4">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              open={!!open[review.id]}
              onToggle={() => setOpen((o) => ({ ...o, [review.id]: !o[review.id] }))}
              onMark={mark}
              pendingId={pendingId}
              fired={fired}
            />
          ))}
        </div>
      )}
    </div>
  );
}

const SOURCE_LABEL: Record<string, string> = {
  ci: "CI",
  github: "GitHub",
  manual: "Manual",
};

function ReviewCard({
  review,
  open,
  onToggle,
  onMark,
  pendingId,
  fired,
}: {
  review: PrReviewDTO;
  open: boolean;
  onToggle: () => void;
  onMark: (f: PrReviewFindingDTO, target: Exclude<ReviewFeedback, "pending">) => void;
  pendingId: string | null;
  fired: Record<string, Fired>;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      <button
        onClick={onToggle}
        aria-expanded={open}
        className="flex w-full items-start justify-between gap-3 p-5 text-left transition hover:bg-[var(--surface-2)]/60"
      >
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] px-2 py-0.5 text-xs text-[var(--muted)]">
              {SOURCE_LABEL[review.source] ?? review.source}
            </span>
            {review.prNumber != null ? (
              <span className="font-mono text-xs text-[var(--faint)]">#{review.prNumber}</span>
            ) : null}
            <span className="text-xs text-[var(--faint)]">{timeAgo(review.createdAt)}</span>
            <span className="text-xs text-[var(--faint)]">
              · {review.findingCount} {review.findingCount === 1 ? "finding" : "findings"}
            </span>
          </div>
          <h3 className="font-display truncate text-base font-semibold text-[var(--text)]">
            {review.prTitle}
          </h3>
          {review.summary ? (
            <p className={cn("mt-1 text-sm text-[var(--muted)]", open ? "" : "line-clamp-2")}>
              {review.summary}
            </p>
          ) : null}
        </div>
        <svg
          className={cn(
            "mt-1 shrink-0 text-[var(--muted)] transition-transform",
            open ? "rotate-180" : "",
          )}
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>

      {open ? (
        <div className="border-t border-[var(--border)] p-4 sm:p-5">
          {review.findings.length === 0 ? (
            <p className="px-1 py-2 text-sm text-[var(--muted)]">
              No findings — this review flagged nothing.
            </p>
          ) : (
            <ul className="space-y-3">
              {review.findings.map((finding) => (
                <FindingRow
                  key={finding.id}
                  finding={finding}
                  onMark={onMark}
                  busy={pendingId === finding.id}
                  fired={fired[finding.id]}
                />
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}

const SEVERITY: Record<ReviewSeverity, { label: string; token: string }> = {
  blocker: { label: "blocker", token: "--alert" },
  warning: { label: "warning", token: "--signal" },
  nit: { label: "nit", token: "--accent" },
  praise: { label: "praise", token: "--verify" },
};

function SeverityChip({ severity }: { severity: ReviewSeverity }) {
  const s = SEVERITY[severity] ?? SEVERITY.nit;
  return (
    <span
      className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize"
      style={{
        color: `var(${s.token})`,
        borderColor: `color-mix(in oklab, var(${s.token}) 32%, transparent)`,
        background: `color-mix(in oklab, var(${s.token}) 14%, transparent)`,
      }}
    >
      {s.label}
    </span>
  );
}

function FindingRow({
  finding,
  onMark,
  busy,
  fired,
}: {
  finding: PrReviewFindingDTO;
  onMark: (f: PrReviewFindingDTO, target: Exclude<ReviewFeedback, "pending">) => void;
  busy: boolean;
  fired?: Fired;
}) {
  const accepted = finding.feedback === "accepted";
  const dismissed = finding.feedback === "dismissed";

  return (
    <li className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <SeverityChip severity={finding.severity} />
        <span className="font-medium text-[var(--text)]">{finding.title}</span>
        {finding.path ? (
          <span className="font-mono text-xs text-[var(--faint)]">
            {finding.path}
            {finding.line != null ? `:${finding.line}` : ""}
          </span>
        ) : null}
      </div>

      {finding.detail ? (
        <p className="mt-2 text-sm text-[var(--muted)]">{finding.detail}</p>
      ) : null}

      {finding.memoryTitle ? (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs text-[var(--muted)]">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
            <path
              d="M12 3a5 5 0 0 0-5 5c0 1.3.5 2.5 1.3 3.4A4 4 0 0 0 7 15a4 4 0 0 0 5 3.9A4 4 0 0 0 17 15a4 4 0 0 0-1.3-3.6A5 5 0 0 0 12 3Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
          </svg>
          <span>
            grounded in <span className="text-[var(--text)]">{finding.memoryTitle}</span>
          </span>
        </div>
      ) : null}

      {fired ? (
        <div
          className="mt-2.5 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-medium"
          style={{
            color: "var(--signal)",
            borderColor: "color-mix(in oklab, var(--signal) 34%, transparent)",
            background: "var(--signal-soft)",
            boxShadow: "0 0 16px color-mix(in oklab, var(--signal) 22%, transparent)",
          }}
        >
          <span aria-hidden>✦</span>
          <span>
            signal fired · memory confidence {fired.from.toFixed(2)} → {fired.to.toFixed(2)}
          </span>
        </div>
      ) : null}

      <div className="mt-3 flex items-center gap-2">
        <FeedbackButton
          kind="accept"
          active={accepted}
          disabled={busy}
          onClick={() => onMark(finding, "accepted")}
        />
        <FeedbackButton
          kind="dismiss"
          active={dismissed}
          disabled={busy}
          onClick={() => onMark(finding, "dismissed")}
        />
        {finding.feedback !== "pending" ? (
          <span className="text-xs text-[var(--faint)]">
            {finding.feedback}
            {finding.feedbackAt ? ` · ${timeAgo(finding.feedbackAt)}` : ""}
          </span>
        ) : null}
      </div>
    </li>
  );
}

function FeedbackButton({
  kind,
  active,
  disabled,
  onClick,
}: {
  kind: "accept" | "dismiss";
  active: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const token = kind === "accept" ? "--verify" : "--alert";
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className="inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      style={
        active
          ? {
              color: `var(${token})`,
              borderColor: `color-mix(in oklab, var(${token}) 45%, transparent)`,
              background: `color-mix(in oklab, var(${token}) 16%, transparent)`,
            }
          : {
              color: "var(--muted)",
              borderColor: "var(--border)",
              background: "transparent",
            }
      }
    >
      {kind === "accept" ? (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M5 12l4.5 4.5L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ) : (
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden>
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
        </svg>
      )}
      {kind === "accept" ? (active ? "Accepted" : "Accept") : active ? "Dismissed" : "Dismiss"}
    </button>
  );
}
