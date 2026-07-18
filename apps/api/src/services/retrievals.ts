import { prisma } from "../db.js";
import { planLimits } from "@memmo/shared";

/**
 * Usage metering. Pricing is on memory retrievals — every time an agent pulls
 * memory (the MCP calls below). Billing is org-level, so usage is aggregated
 * across all of an organization's projects and compared to the org's plan cap.
 */
export const RETRIEVAL_TYPES = [
  "mcp.search_memory",
  "mcp.get_repo_context",
  "mcp.get_relevant_warnings",
];

function startOfMonth(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
}

async function workspaceIdsForOrg(organizationId: string): Promise<string[]> {
  const rows = await prisma.workspace.findMany({
    where: { organizationId },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

/** Retrievals used by an org (across its projects) in the current month. */
export async function retrievalsThisMonthForOrg(organizationId: string): Promise<number> {
  const ids = await workspaceIdsForOrg(organizationId);
  if (ids.length === 0) return 0;
  return prisma.usageEvent.count({
    where: {
      workspaceId: { in: ids },
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

/** Current-month retrievals + plan allotment for an org. */
export async function retrievalUsageForOrg(organizationId: string): Promise<RetrievalUsage> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { plan: true },
  });
  const limits = planLimits(org?.plan ?? "free");
  const used = await retrievalsThisMonthForOrg(organizationId);
  return { used, limit: limits.retrievalsPerMonth, hardCap: limits.hardCap };
}

/** Usage for the org that owns a workspace (what the project meter shows). */
export async function retrievalUsageForWorkspace(workspaceId: string): Promise<RetrievalUsage> {
  const w = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });
  if (!w) return { used: 0, limit: planLimits("free").retrievalsPerMonth, hardCap: true };
  return retrievalUsageForOrg(w.organizationId);
}

/**
 * Whether the org that owns this workspace has exhausted its retrievals AND is
 * on a hard cap (Free). Paid tiers never block — an agent is never left without
 * memory mid-sprint.
 */
export async function retrievalBlockedForWorkspace(workspaceId: string): Promise<boolean> {
  const w = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true, organization: { select: { plan: true } } },
  });
  if (!w) return false;
  const limits = planLimits(w.organization.plan);
  if (!limits.hardCap || limits.retrievalsPerMonth === null) return false;
  const used = await retrievalsThisMonthForOrg(w.organizationId);
  return used >= limits.retrievalsPerMonth;
}

/** Retrievals per month for the last `months` months across an org's projects. */
export async function retrievalHistoryForOrg(
  organizationId: string,
  months = 6,
): Promise<{ month: string; count: number }[]> {
  const ids = await workspaceIdsForOrg(organizationId);
  if (ids.length === 0) return [];
  const rows = await prisma.$queryRawUnsafe<{ month: Date; count: bigint }[]>(
    `SELECT date_trunc('month', "createdAt") AS month, count(*) AS count
       FROM "UsageEvent"
      WHERE "workspaceId" = ANY($1)
        AND "type" = ANY($2)
        AND "createdAt" >= date_trunc('month', now()) - ($3 || ' months')::interval
      GROUP BY 1
      ORDER BY 1 DESC`,
    ids,
    RETRIEVAL_TYPES,
    String(months - 1),
  );
  return rows.map((r) => ({
    month: new Date(r.month).toISOString().slice(0, 7),
    count: Number(r.count),
  }));
}
