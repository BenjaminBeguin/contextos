import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import { setPlanSchema, PLANS } from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, isSuperAdmin } from "../auth.js";

const addMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(["owner", "admin", "member", "viewer"]).default("member"),
});

/** Resolve the caller and require superadmin; returns the user or sends 401/403. */
async function requireAdmin(req: FastifyRequest, reply: FastifyReply) {
  const user = await resolveUser(req);
  if (!user) {
    reply.code(401).send({ error: "Unauthorized" });
    return null;
  }
  if (!isSuperAdmin(user)) {
    reply.code(403).send({ error: "forbidden" });
    return null;
  }
  return user;
}

export async function adminRoutes(app: FastifyInstance) {
  // Is the caller a superadmin? (drives whether the app shows the Admin link)
  app.get("/admin/whoami", async (req) => {
    const user = await resolveUser(req);
    return { isSuperAdmin: isSuperAdmin(user) };
  });

  // Platform overview: totals, plan breakdown, rough MRR, recent billing.
  app.get("/admin/overview", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const [users, workspaces, repos, memories, byPlan, recentEvents] = await Promise.all([
      prisma.user.count(),
      prisma.workspace.count(),
      prisma.repo.count(),
      prisma.memory.count(),
      prisma.workspace.groupBy({ by: ["plan"], _count: { _all: true } }),
      prisma.billingEvent.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
    ]);

    const plans = Object.fromEntries(PLANS.map((p) => [p, 0])) as Record<string, number>;
    for (const row of byPlan) plans[row.plan] = row._count._all;

    // Rough monthly recurring revenue from paid invoices in the last 31 days.
    const since = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
    const paid = await prisma.billingEvent.aggregate({
      _sum: { amountCents: true },
      where: { status: "paid", createdAt: { gte: since } },
    });

    return {
      totals: { users, workspaces, repos, memories },
      plans,
      mrrCents: paid._sum.amountCents ?? 0,
      recentEvents,
    };
  });

  // Every workspace with owner, plan, and size — the management table.
  app.get("/admin/workspaces", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;

    const workspaces = await prisma.workspace.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        memberships: { include: { user: { select: { email: true, name: true } } } },
        _count: { select: { repos: true, memberships: true } },
      },
    });

    return workspaces.map((w) => {
      const owner = w.memberships.find((m) => m.role === "owner") ?? w.memberships[0];
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        plan: w.plan,
        planSource: w.planSource,
        planStatus: w.planStatus,
        planNote: w.planNote,
        planUpdatedAt: w.planUpdatedAt,
        createdAt: w.createdAt,
        repoCount: w._count.repos,
        memberCount: w._count.memberships,
        owner: owner ? { email: owner.user.email, name: owner.user.name } : null,
      };
    });
  });

  // Set a workspace's plan (promote-for-free = plan + source "comp"). Logged.
  app.post("/admin/workspaces/:workspaceId/plan", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { workspaceId } = req.params as { workspaceId: string };
    const body = setPlanSchema.parse(req.body);

    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        plan: body.plan,
        planSource: body.source,
        planStatus: body.status,
        planNote: body.note ?? null,
        planUpdatedAt: new Date(),
      },
    });

    await prisma.billingEvent.create({
      data: {
        workspaceId,
        type: ws.plan === body.plan ? "plan.changed" : "plan.granted",
        plan: body.plan,
        status: body.source === "comp" ? "comp" : null,
        note: body.note ?? null,
        actorEmail: admin.email,
        metadata: { from: ws.plan, to: body.plan, source: body.source },
      },
    });

    return {
      id: updated.id,
      plan: updated.plan,
      planSource: updated.planSource,
      planStatus: updated.planStatus,
      planNote: updated.planNote,
      planUpdatedAt: updated.planUpdatedAt,
    };
  });

  // Full detail for one workspace — members, repos, plan — for admin management.
  app.get("/admin/workspaces/:workspaceId", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { workspaceId } = req.params as { workspaceId: string };
    const w = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        memberships: {
          orderBy: { role: "asc" },
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        },
        repos: { select: { id: true, fullName: true, _count: { select: { memories: true } } } },
      },
    });
    if (!w) return reply.code(404).send({ error: "Workspace not found" });
    return {
      id: w.id,
      name: w.name,
      slug: w.slug,
      joinCode: w.joinCode,
      plan: w.plan,
      planSource: w.planSource,
      planStatus: w.planStatus,
      planNote: w.planNote,
      createdAt: w.createdAt,
      members: w.memberships.map((m) => ({
        userId: m.userId,
        role: m.role,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
      })),
      repos: w.repos.map((r) => ({ id: r.id, fullName: r.fullName, memories: r._count.memories })),
    };
  });

  // Add a member to a workspace by email (the user must already have an account).
  app.post("/admin/workspaces/:workspaceId/members", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { workspaceId } = req.params as { workspaceId: string };
    const body = addMemberSchema.parse(req.body);
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });
    const target = await prisma.user.findFirst({
      where: { email: { equals: body.email, mode: "insensitive" } },
    });
    if (!target) return reply.code(404).send({ error: "No Cortex account with that email." });
    const existing = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: target.id, workspaceId } },
    });
    if (existing) return reply.code(409).send({ error: "Already a member." });
    await prisma.membership.create({ data: { userId: target.id, workspaceId, role: body.role } });
    return reply.code(201).send({ ok: true });
  });

  // Remove a member (blocked if they're the last owner — keeps the workspace reachable).
  app.delete("/admin/workspaces/:workspaceId/members/:userId", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { workspaceId, userId } = req.params as { workspaceId: string; userId: string };
    const membership = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!membership) return reply.code(404).send({ error: "Not a member." });
    if (membership.role === "owner") {
      const owners = await prisma.membership.count({ where: { workspaceId, role: "owner" } });
      if (owners <= 1) return reply.code(409).send({ error: "Can't remove the last owner." });
    }
    await prisma.membership.delete({ where: { userId_workspaceId: { userId, workspaceId } } });
    return { ok: true };
  });

  // Delete a workspace entirely (cascades to repos, memory, sessions, reviews…).
  app.delete("/admin/workspaces/:workspaceId", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { workspaceId } = req.params as { workspaceId: string };
    const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { name: true } });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });
    await prisma.workspace.delete({ where: { id: workspaceId } });
    return { ok: true };
  });

  // The billing / payment log (plan grants now, Stripe invoices once wired).
  app.get("/admin/billing-events", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const q = req.query as { limit?: string };
    const limit = Math.min(Math.max(parseInt(q.limit ?? "100", 10) || 100, 1), 500);
    const events = await prisma.billingEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { workspace: { select: { name: true, slug: true } } },
    });
    return events;
  });
}
