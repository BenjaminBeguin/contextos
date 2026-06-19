import { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export interface SearchParams {
  repoId: string;
  query: string;
  limit: number;
  approvedOnly?: boolean;
}

/**
 * Keyword search over a repo's memories using case-insensitive matching on
 * title/content. Ordered by confidence then freshness. pgvector semantic
 * search is a deferred enhancement (see plan).
 */
export async function searchMemories({ repoId, query, limit, approvedOnly }: SearchParams) {
  const where: Prisma.MemoryWhereInput = { repoId };
  if (approvedOnly) where.status = "approved";

  const trimmed = query.trim();
  if (trimmed.length > 0) {
    where.OR = [
      { title: { contains: trimmed, mode: "insensitive" } },
      { content: { contains: trimmed, mode: "insensitive" } },
    ];
  }

  const memories = await prisma.memory.findMany({
    where,
    orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
    take: limit,
    include: { evidence: true },
  });

  if (memories.length > 0) {
    await prisma.memory.updateMany({
      where: { id: { in: memories.map((m) => m.id) } },
      data: { lastUsedAt: new Date() },
    });
  }

  return memories;
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
