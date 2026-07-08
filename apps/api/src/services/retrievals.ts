import { prisma } from "../db.js";
import { planLimits } from "@cortex/shared";

/**
 * Usage metering. Pricing is on memory retrievals — every time an agent pulls
 * memory (the MCP calls below). We count UsageEvents in the shared control
 * plane (telemetry lives there even for BYODB workspaces), per workspace, per
 * calendar month.
 */
export const RETRIEVAL_TYPES = [
  "mcp.search_memory",
  "mcp.get_repo_context",
  "mcp.get_relevant_warnings",
];

function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

/** Retrievals used by a workspace in the current calendar month. */
export async function retrievalsThisMonth(workspaceId: string): Promise<number> {
  return prisma.usageEvent.count({
    where: {
      workspaceId,
      type: { in: RETRIEVAL_TYPES },
      createdAt: { gte: startOfMonth() },
    },
  });
}

export interface RetrievalUsage {
  used: number;
  limit: number | null;
  hardCap: boolean;
}

/** Current-month retrievals + the plan allotment, for meters and gating. */
export async function retrievalUsage(workspaceId: string, plan: string): Promise<RetrievalUsage> {
  const limits = planLimits(plan);
  const used = await retrievalsThisMonth(workspaceId);
  return { used, limit: limits.retrievalsPerMonth, hardCap: limits.hardCap };
}

/**
 * Whether a workspace has exhausted its included retrievals AND is on a hard cap
 * (Free). Paid tiers never block — they only warn/upsell — so an agent is never
 * left without memory mid-sprint.
 */
export async function retrievalBlocked(workspaceId: string, plan: string): Promise<boolean> {
  const limits = planLimits(plan);
  if (!limits.hardCap || limits.retrievalsPerMonth === null) return false;
  const used = await retrievalsThisMonth(workspaceId);
  return used >= limits.retrievalsPerMonth;
}

/** Convenience: look up the plan and decide if retrieval is hard-capped. */
export async function retrievalBlockedForWorkspace(workspaceId: string): Promise<boolean> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { plan: true },
  });
  return retrievalBlocked(workspaceId, ws?.plan ?? "free");
}

/** Retrievals per month for the last `months` calendar months (most recent first). */
export async function retrievalHistory(
  workspaceId: string,
  months = 6,
): Promise<{ month: string; count: number }[]> {
  const rows = await prisma.$queryRawUnsafe<{ month: Date; count: bigint }[]>(
    `SELECT date_trunc('month', "createdAt") AS month, count(*) AS count
       FROM "UsageEvent"
      WHERE "workspaceId" = $1
        AND "type" = ANY($2)
        AND "createdAt" >= date_trunc('month', now()) - ($3 || ' months')::interval
      GROUP BY 1
      ORDER BY 1 DESC`,
    workspaceId,
    RETRIEVAL_TYPES,
    String(months - 1),
  );
  return rows.map((r) => ({
    month: new Date(r.month).toISOString().slice(0, 7),
    count: Number(r.count),
  }));
}
