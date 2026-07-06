/**
 * Persistence + confidence feedback for PR reviews. The pure confidence math lives in
 * `@cortex/shared` (unit-tested); this module wires it to Prisma, audit logs, and usage
 * telemetry. Persisting a review is best-effort — callers wrap it so a failure never
 * breaks returning the review to the client.
 */
import type { PrReview, PrReviewFinding } from "@prisma/client";
import {
  type Finding,
  type ReviewFeedback,
  type ReviewSeverity,
  type PrReviewDTO,
  type PrReviewFindingDTO,
  findingKey,
  confidenceDelta,
  applyFeedback,
} from "@cortex/shared";
import { prisma } from "../db.js";
import { HttpError } from "../auth.js";
import { writeAuditLog } from "./memory.js";
import { recordUsage } from "./analytics.js";

export interface PersistReviewParams {
  repoId: string;
  source: "ci" | "github" | "manual";
  prTitle: string;
  prNumber?: number | null;
  summary: string;
  findings: Finding[];
}

/**
 * Build a lowercase-title → memoryId map for a repo, so each finding's referenced
 * memory title can be resolved to a concrete memory (case-insensitive exact match).
 */
export async function resolveMemoryIds(
  repoId: string,
  findings: Finding[],
): Promise<Map<string, string>> {
  const wanted = findings.some((f) => f.memory);
  if (!wanted) return new Map();
  const memories = await prisma.memory.findMany({
    where: { repoId },
    select: { id: true, title: true },
  });
  const byTitle = new Map<string, string>();
  for (const m of memories) byTitle.set(m.title.toLowerCase(), m.id);
  return byTitle;
}

/** Persist a generated review plus its findings, resolving each finding's grounding memory. */
export async function persistReview(params: PersistReviewParams) {
  const byTitle = await resolveMemoryIds(params.repoId, params.findings);
  return prisma.prReview.create({
    data: {
      repoId: params.repoId,
      source: params.source,
      prTitle: params.prTitle,
      prNumber: params.prNumber ?? null,
      summary: params.summary,
      findingCount: params.findings.length,
      findings: {
        create: params.findings.map((f) => ({
          key: findingKey(f),
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          path: f.path ?? null,
          line: f.line ?? null,
          memoryTitle: f.memory ?? null,
          memoryId: f.memory ? (byTitle.get(f.memory.toLowerCase()) ?? null) : null,
        })),
      },
    },
    include: { findings: true },
  });
}

export interface FeedbackResult {
  finding: PrReviewFindingDTO;
  memory?: { id: string; confidence: number; previousConfidence: number };
}

/**
 * Apply feedback to a finding. When the finding is grounded in a memory and the feedback
 * transition actually moves confidence, adjust that memory (clamped), audit it, and record
 * the event. Reversible: re-marking undoes the previous effect (see `confidenceDelta`).
 */
export async function applyFindingFeedback(
  findingId: string,
  newFeedback: ReviewFeedback,
  userId?: string | null,
): Promise<FeedbackResult> {
  const finding = await prisma.prReviewFinding.findUnique({
    where: { id: findingId },
    include: { memory: true, review: { include: { repo: true } } },
  });
  if (!finding) throw new HttpError(404, "Finding not found");

  const oldFeedback = finding.feedback as ReviewFeedback;
  const delta = confidenceDelta(oldFeedback, newFeedback);
  const workspaceId = finding.review.repo.workspaceId;

  let memory: FeedbackResult["memory"];
  if (finding.memoryId && finding.memory && delta !== 0) {
    const previousConfidence = finding.memory.confidence;
    const confidence = applyFeedback(previousConfidence, oldFeedback, newFeedback);
    const updated = await prisma.memory.update({
      where: { id: finding.memoryId },
      data: { confidence },
    });
    memory = { id: updated.id, confidence: updated.confidence, previousConfidence };
    await writeAuditLog({
      workspaceId,
      userId,
      action: "memory.confidence_adjusted",
      entityType: "memory",
      entityId: finding.memoryId,
      metadata: {
        findingId,
        from: oldFeedback,
        to: newFeedback,
        delta,
        previousConfidence,
        confidence,
      },
    });
  }

  const updatedFinding = await prisma.prReviewFinding.update({
    where: { id: findingId },
    data: { feedback: newFeedback, feedbackAt: new Date() },
  });

  await recordUsage("review.feedback", {
    workspaceId,
    repoId: finding.review.repoId,
    metadata: { findingId, from: oldFeedback, to: newFeedback, delta },
  });

  return { finding: toFindingDTO(updatedFinding), memory };
}

/**
 * Apply feedback keyed by finding dedup `key` (used by `cortex review-sync` to push GitHub
 * 👍/👎 back). For each item, the most-recent matching finding in this repo wins.
 */
export async function applyBulkFeedbackByKey(
  repoId: string,
  items: { key: string; feedback: ReviewFeedback }[],
  userId?: string | null,
): Promise<{ updated: number }> {
  let updated = 0;
  for (const item of items) {
    const finding = await prisma.prReviewFinding.findFirst({
      where: { key: item.key, review: { repoId } },
      orderBy: { createdAt: "desc" },
      select: { id: true },
    });
    if (!finding) continue;
    await applyFindingFeedback(finding.id, item.feedback, userId);
    updated++;
  }
  return { updated };
}

export function toFindingDTO(f: PrReviewFinding): PrReviewFindingDTO {
  return {
    id: f.id,
    key: f.key,
    severity: f.severity as ReviewSeverity,
    title: f.title,
    detail: f.detail,
    path: f.path,
    line: f.line,
    memoryId: f.memoryId,
    memoryTitle: f.memoryTitle,
    feedback: f.feedback as ReviewFeedback,
    feedbackAt: f.feedbackAt ? f.feedbackAt.toISOString() : null,
    createdAt: f.createdAt.toISOString(),
  };
}

export function toReviewDTO(r: PrReview & { findings?: PrReviewFinding[] }): PrReviewDTO {
  return {
    id: r.id,
    prNumber: r.prNumber,
    prTitle: r.prTitle,
    source: r.source,
    summary: r.summary,
    findingCount: r.findingCount,
    createdAt: r.createdAt.toISOString(),
    findings: (r.findings ?? []).map(toFindingDTO),
  };
}
