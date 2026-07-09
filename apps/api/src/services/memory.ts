import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { memoryStoreForRepo } from "./memoryStore.js";
import { rankMemories } from "./ranking.js";

export interface SearchParams {
  repoId: string;
  query: string;
  limit: number;
  approvedOnly?: boolean;
  /** Count these retrievals toward each memory's usageCount (agent/MCP only, not web browsing). */
  countUsage?: boolean;
}

// Most memories we score in-process for a single query. Repo-scale corpora sit
// well under this; the pgvector/indexed-candidate path (roadmap) lifts the cap.
const CANDIDATE_CAP = 500;

/**
 * Retrieve a repo's memories most relevant to `query`, ranked by the blended
 * score (relevance × confidence × recency × impact — see ranking.ts) rather than
 * confidence alone. We pull the candidate set from the workspace's memory store
 * (so a bring-your-own-database project searches its own Postgres), rank them,
 * and mark the winners retrieved. An empty query ranks by confidence/recency/
 * impact, which is what the context-injection and review flows want.
 */
export async function searchMemories({ repoId, query, limit, approvedOnly, countUsage }: SearchParams) {
  const { store } = await memoryStoreForRepo(repoId);
  const candidates = (
    await store.listByRepo(repoId, approvedOnly ? { status: "approved" } : {})
  ).slice(0, CANDIDATE_CAP);
  const ranked = rankMemories(query, candidates, { limit, now: new Date() });
  if (ranked.length > 0) {
    await store.markRetrieved(ranked.map((m) => m.id), countUsage ?? false);
  }
  return ranked;
}

export interface AutoThresholds {
  approve: number | null;
  reject: number | null;
}

/** The workspace's auto-approve / auto-reject confidence thresholds (null = disabled). */
export async function getAutoThresholds(workspaceId: string): Promise<AutoThresholds> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { autoApproveThreshold: true, autoRejectThreshold: true },
  });
  return { approve: ws?.autoApproveThreshold ?? null, reject: ws?.autoRejectThreshold ?? null };
}

/**
 * Route a new memory by confidence: at/above the approve threshold → approved,
 * below the reject threshold → rejected, otherwise → proposed (inbox). Approve
 * takes precedence if the thresholds overlap.
 */
export function statusFor(
  t: AutoThresholds,
  confidence: number,
): "approved" | "proposed" | "rejected" {
  if (t.approve != null && confidence >= t.approve) return "approved";
  if (t.reject != null && confidence < t.reject) return "rejected";
  return "proposed";
}

export async function writeAuditLog(params: {
  workspaceId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}) {
  await prisma.auditLog.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId ?? null,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      metadata: params.metadata,
    },
  });
}
