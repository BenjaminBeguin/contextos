import { createHmac, timingSafeEqual } from "node:crypto";
import type { RecordSessionInput } from "@memmo/shared";

/**
 * Merged-PR → memory. GitHub PRs are a curated, low-noise source of "decision"
 * and "risk" memory (the description says *what changed and why*). This module
 * has the pure, testable pieces; the route wires them to extraction + triage.
 */

/** Verify a GitHub `X-Hub-Signature-256` header against the raw body (timing-safe). */
export function verifyGithubSignature(secret: string, rawBody: Buffer, header: string | undefined): boolean {
  if (!secret || !header) return false;
  const expected = "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface PullRequestPayload {
  action?: string;
  pull_request?: {
    number?: number;
    title?: string;
    body?: string | null;
    merged?: boolean;
    html_url?: string;
    user?: { login?: string };
  };
  repository?: { full_name?: string };
}

/** True only for a genuinely merged PR (closed + merged), which is when the
    decision is final and worth remembering. */
export function isMergedPr(event: string | undefined, payload: PullRequestPayload): boolean {
  return event === "pull_request" && payload.action === "closed" && payload.pull_request?.merged === true;
}

/**
 * Turn a merged PR into the extractor's input. The title is the task and the
 * description is the reasoning (the "why") — so the reasoning-aware extractor
 * produces decision/risk memories, not a restatement of the diff.
 */
export function prToSessionInput(payload: PullRequestPayload): RecordSessionInput | null {
  const pr = payload.pull_request;
  if (!pr?.title) return null;
  const body = (pr.body ?? "").trim();
  return {
    agent: "github",
    task: pr.title,
    summary: `Merged PR #${pr.number ?? "?"}: ${pr.title}`,
    reasoning: body || undefined,
    // Nothing mechanical to mine here — the signal is the title + description.
  };
}
