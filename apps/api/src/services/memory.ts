import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";
import { memoryStoreForRepo } from "./memoryStore.js";

export interface SearchParams {
  repoId: string;
  query: string;
  limit: number;
  approvedOnly?: boolean;
  /** Count these retrievals toward each memory's usageCount (agent/MCP only, not web browsing). */
  countUsage?: boolean;
}

/**
 * Keyword search over a repo's memories using case-insensitive matching on
 * title/content. Ordered by confidence then freshness. Routed through the
 * workspace's memory store, so a bring-your-own-database project searches its
 * own Postgres. pgvector semantic search is a deferred enhancement (see plan).
 */
export async function searchMemories({ repoId, query, limit, approvedOnly, countUsage }: SearchParams) {
  const { store } = await memoryStoreForRepo(repoId);
  return store.search({ repoId, query, limit, approvedOnly, countUsage });
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
