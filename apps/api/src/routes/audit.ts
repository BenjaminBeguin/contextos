import type { FastifyInstance } from "fastify";
import { planLimits } from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, requireRole, HttpError } from "../auth.js";

interface AuditRow {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  actor: string;
  metadata: unknown;
  createdAt: Date;
}

async function loadAudit(workspaceId: string, limit: number): Promise<AuditRow[]> {
  const entries = await prisma.auditLog.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  const userIds = [...new Set(entries.map((e) => e.userId).filter((v): v is string => !!v))];
  const users = userIds.length
    ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, email: true } })
    : [];
  const email = new Map(users.map((u) => [u.id, u.email]));
  return entries.map((e) => ({
    id: e.id,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    actor: (e.userId && email.get(e.userId)) || "system",
    metadata: e.metadata,
    createdAt: e.createdAt,
  }));
}

function csvCell(v: unknown): string {
  const s = v == null ? "" : typeof v === "string" ? v : JSON.stringify(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function auditRoutes(app: FastifyInstance) {
  // Audit log for a workspace (admin+; export is a Business+ feature).
  async function guard(userId: string, workspaceId: string) {
    const membership = await requireRole(userId, workspaceId, "admin");
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organization: { select: { plan: true } } },
    });
    if (!planLimits(ws?.organization.plan ?? "free").audit) {
      throw new HttpError(402, "plan_limit_audit");
    }
    return membership;
  }

  app.get("/workspaces/:workspaceId/audit", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await guard(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const q = req.query as { limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "200", 10) || 200, 1), 1000);
    return loadAudit(workspaceId, limit);
  });

  // CSV export (top-level GET so it downloads with the session cookie).
  app.get("/workspaces/:workspaceId/audit.csv", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await guard(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const rows = await loadAudit(workspaceId, 5000);
    const header = ["createdAt", "actor", "action", "entityType", "entityId", "metadata"];
    const lines = [
      header.join(","),
      ...rows.map((r) =>
        [r.createdAt.toISOString(), r.actor, r.action, r.entityType, r.entityId, r.metadata]
          .map(csvCell)
          .join(","),
      ),
    ];
    reply
      .header("content-type", "text/csv; charset=utf-8")
      .header("content-disposition", `attachment; filename="cortex-audit-${workspaceId}.csv"`)
      .send(lines.join("\n"));
  });
}
