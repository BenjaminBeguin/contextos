import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, HttpError } from "../auth.js";

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function metricsRoutes(app: FastifyInstance) {
  // Public aggregate stats for the marketing site (no PII).
  app.get("/stats", async () => {
    const [waitlistCount, memoriesTracked, workspaces] = await Promise.all([
      prisma.waitlistSignup.count(),
      prisma.memory.count(),
      prisma.workspace.count(),
    ]);
    return { waitlistCount, memoriesTracked, workspaces };
  });

  // Per-workspace usage metrics for the product dashboard.
  app.get("/workspaces/:workspaceId/metrics", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await assertWorkspaceAccess(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }

    const repos = await prisma.repo.findMany({
      where: { workspaceId },
      select: { id: true, fullName: true, _count: { select: { memories: true } } },
    });
    const repoIds = repos.map((r) => r.id);

    const since30 = new Date(Date.now() - 30 * 86400_000);
    const since7 = new Date(Date.now() - 7 * 86400_000);
    const since14 = new Date(Date.now() - 14 * 86400_000);

    const [
      statusGroups,
      retrievals30,
      retrievals7,
      seriesEvents,
      contextInjections30,
      warningEvents30,
      sessions30,
      approved30,
      approvedByRepo,
    ] = await Promise.all([
      prisma.memory.groupBy({
        by: ["status"],
        where: { repoId: { in: repoIds } },
        _count: true,
      }),
      prisma.usageEvent.count({
        where: { workspaceId, type: "mcp.search_memory", createdAt: { gte: since30 } },
      }),
      prisma.usageEvent.count({
        where: { workspaceId, type: "mcp.search_memory", createdAt: { gte: since7 } },
      }),
      prisma.usageEvent.findMany({
        where: { workspaceId, type: "mcp.search_memory", createdAt: { gte: since14 } },
        select: { createdAt: true },
      }),
      // Context primed into agents (SessionStart hook + manual get_repo_context).
      prisma.usageEvent.count({
        where: { workspaceId, type: "mcp.get_repo_context", createdAt: { gte: since30 } },
      }),
      // Risk warnings: count checks and sum how many actually matched a risky file.
      prisma.usageEvent.findMany({
        where: { workspaceId, type: "mcp.get_relevant_warnings", createdAt: { gte: since30 } },
        select: { metadata: true },
      }),
      prisma.usageEvent.count({
        where: { workspaceId, type: "session.recorded", createdAt: { gte: since30 } },
      }),
      prisma.usageEvent.count({
        where: { workspaceId, type: "memory.approved", createdAt: { gte: since30 } },
      }),
      prisma.memory.groupBy({
        by: ["repoId"],
        where: { repoId: { in: repoIds }, status: "approved" },
        _count: true,
      }),
    ]);

    const memoryCounts: Record<string, number> = {};
    for (const g of statusGroups) memoryCounts[g.status] = g._count;

    let warningsMatched = 0;
    for (const e of warningEvents30) {
      const m = (e.metadata ?? {}) as { matched?: number };
      if (typeof m.matched === "number") warningsMatched += m.matched;
    }
    const reposWithMemory = approvedByRepo.length;

    // Measured with/without: compare error rates of sessions that used Cortex
    // memory (a hook retrieval/warning carried their session id) vs those that didn't.
    const [sessionList, memoryUseEvents] = await Promise.all([
      prisma.agentSession.findMany({
        where: { repoId: { in: repoIds }, createdAt: { gte: since30 } },
        select: { externalId: true, errorCount: true },
      }),
      prisma.usageEvent.findMany({
        where: {
          workspaceId,
          sessionId: { not: null },
          type: { in: ["mcp.get_repo_context", "mcp.get_relevant_warnings", "mcp.search_memory"] },
          createdAt: { gte: since30 },
        },
        select: { sessionId: true },
      }),
    ]);
    const memorySessionIds = new Set(memoryUseEvents.map((e) => e.sessionId).filter(Boolean));
    let withN = 0;
    let withErr = 0;
    let woN = 0;
    let woErr = 0;
    for (const s of sessionList) {
      if (s.externalId && memorySessionIds.has(s.externalId)) {
        withN++;
        withErr += s.errorCount;
      } else {
        woN++;
        woErr += s.errorCount;
      }
    }
    const comparison = {
      withMemory: { sessions: withN, avgErrors: withN ? +(withErr / withN).toFixed(2) : 0 },
      withoutMemory: { sessions: woN, avgErrors: woN ? +(woErr / woN).toFixed(2) : 0 },
    };

    // Bucket retrievals into the last 14 days.
    const buckets: Record<string, number> = {};
    for (let i = 13; i >= 0; i--) {
      buckets[dayKey(new Date(Date.now() - i * 86400_000))] = 0;
    }
    for (const e of seriesEvents) {
      const k = dayKey(e.createdAt);
      if (k in buckets) buckets[k]! += 1;
    }
    const series = Object.entries(buckets).map(([date, count]) => ({ date, count }));

    return {
      reposCount: repos.length,
      memoryCounts,
      approvedMemories: memoryCounts["approved"] ?? 0,
      pendingMemories: memoryCounts["proposed"] ?? 0,
      retrievals30,
      retrievals7,
      retrievalSeries: series,
      contextInjections30,
      warningChecks30: warningEvents30.length,
      warningsMatched30: warningsMatched,
      sessions30,
      approved30,
      reposWithMemory,
      comparison,
      topRepos: repos
        .map((r) => ({ id: r.id, fullName: r.fullName, memories: r._count.memories }))
        .sort((a, b) => b.memories - a.memories)
        .slice(0, 5),
    };
  });
}
