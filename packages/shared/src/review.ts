/**
 * Shared, dependency-free primitives for the PR reviewer + its feedback loop.
 * Imported by the API (persistence + confidence), the CLI (GitHub dedup markers +
 * feedback sync), and the web app (DTO types). Keep this file pure.
 */

export const REVIEW_SEVERITIES = ["blocker", "warning", "nit", "praise"] as const;
export type ReviewSeverity = (typeof REVIEW_SEVERITIES)[number];

export const REVIEW_FEEDBACK = ["pending", "accepted", "dismissed"] as const;
export type ReviewFeedback = (typeof REVIEW_FEEDBACK)[number];

export interface Finding {
  severity: ReviewSeverity;
  title: string;
  detail: string;
  path?: string;
  line?: number;
  /** Exact title of the memory that grounded this finding, if any. */
  memory?: string;
}

/** URL/marker-safe slug of a finding title. */
export function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

/**
 * Stable dedup key for a finding (path + line + normalized title). This is the
 * identity used both for the GitHub `<!-- cortex-review:KEY -->` marker and for
 * matching human feedback back to a persisted finding.
 */
export function findingKey(f: Pick<Finding, "path" | "line" | "title">): string {
  return `${f.path ?? ""}:${f.line ?? ""}:${slug(f.title)}`;
}

// ---- Confidence feedback rule -------------------------------------------------

/** How much accepting a finding rewards its grounding memory. */
export const ACCEPT_DELTA = 0.05;
/** How much dismissing bites — a little harder than an accept rewards. */
export const DISMISS_DELTA = -0.08;
export const MIN_CONFIDENCE = 0.05;
export const MAX_CONFIDENCE = 0.99;

/** The confidence effect a single feedback state has on the grounding memory. */
export function feedbackEffect(feedback: ReviewFeedback): number {
  if (feedback === "accepted") return ACCEPT_DELTA;
  if (feedback === "dismissed") return DISMISS_DELTA;
  return 0;
}

export function clampConfidence(x: number): number {
  return Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, x));
}

/**
 * Net confidence change when a finding's feedback moves `from` → `to`. Reversible:
 * re-marking undoes the previous effect and applies the new one, so confidence never
 * double-counts a single finding.
 */
export function confidenceDelta(from: ReviewFeedback, to: ReviewFeedback): number {
  return feedbackEffect(to) - feedbackEffect(from);
}

/** Apply a feedback transition to a memory's current confidence (clamped). */
export function applyFeedback(current: number, from: ReviewFeedback, to: ReviewFeedback): number {
  return clampConfidence(current + confidenceDelta(from, to));
}

// ---- DTOs shared between API and web -----------------------------------------

export interface PrReviewFindingDTO {
  id: string;
  key: string;
  severity: ReviewSeverity;
  title: string;
  detail: string;
  path?: string | null;
  line?: number | null;
  memoryId?: string | null;
  memoryTitle?: string | null;
  feedback: ReviewFeedback;
  feedbackAt?: string | null;
  createdAt: string;
}

export interface PrReviewDTO {
  id: string;
  prNumber?: number | null;
  prTitle: string;
  source: string;
  summary: string;
  findingCount: number;
  createdAt: string;
  findings: PrReviewFindingDTO[];
}
