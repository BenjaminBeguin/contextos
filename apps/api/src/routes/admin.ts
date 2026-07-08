import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { z } from "zod";
import {
  setPlanSchema,
  PLANS,
  PLAN_LIMITS,
  PLAN_LABELS,
  PLAN_TAGLINES,
  planLimits,
} from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, isSuperAdmin } from "../auth.js";
import { RETRIEVAL_TYPES, retrievalHistoryForOrg } from "../services/retrievals.js";
import { env } from "../env.js";

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

    const [users, organizations, workspaces, repos, memories, byPlan, recentEvents] =
      await Promise.all([
        prisma.user.count(),
        prisma.organization.count(),
        prisma.workspace.count(),
        prisma.repo.count(),
        prisma.memory.count(),
        prisma.organization.groupBy({ by: ["plan"], _count: { _all: true } }),
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
      totals: { users, organizations, workspaces, repos, memories },
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
        organization: { select: { plan: true, planSource: true, planStatus: true, planNote: true, planUpdatedAt: true } },
        memberships: { include: { user: { select: { email: true, name: true } } } },
        _count: { select: { repos: true, memberships: true } },
      },
    });

    // This month's retrievals per workspace (the usage meter), in one query.
    const monthStart = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1));
    const retr = await prisma.usageEvent.groupBy({
      by: ["workspaceId"],
      where: { type: { in: RETRIEVAL_TYPES }, createdAt: { gte: monthStart } },
      _count: { _all: true },
    });
    const retrMap = new Map(retr.map((r) => [r.workspaceId, r._count._all]));

    return workspaces.map((w) => {
      const owner = w.memberships.find((m) => m.role === "owner") ?? w.memberships[0];
      return {
        id: w.id,
        name: w.name,
        slug: w.slug,
        plan: w.organization.plan,
        planSource: w.organization.planSource,
        planStatus: w.organization.planStatus,
        planNote: w.organization.planNote,
        planUpdatedAt: w.organization.planUpdatedAt,
        createdAt: w.createdAt,
        repoCount: w._count.repos,
        memberCount: w._count.memberships,
        retrievals: retrMap.get(w.id) ?? 0,
        retrievalLimit: planLimits(w.organization.plan).retrievalsPerMonth,
        owner: owner ? { email: owner.user.email, name: owner.user.name } : null,
      };
    });
  });

  // Pricing matrix (plan entitlements + taglines) and configured Stripe Price IDs.
  app.get("/admin/pricing", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const configured = await prisma.planPrice.findMany();
    const priceMap = new Map(configured.map((p) => [p.plan, p.stripePriceId]));
    return {
      stripeEnabled: env.stripe.enabled,
      plans: PLANS.map((plan) => ({
        plan,
        label: PLAN_LABELS[plan],
        tagline: PLAN_TAGLINES[plan],
        limits: PLAN_LIMITS[plan],
        stripePriceId: priceMap.get(plan) ?? env.stripe.prices[plan] ?? null,
        priceSource: priceMap.get(plan) ? "config" : env.stripe.prices[plan] ? "env" : "unset",
      })),
    };
  });

  // Set (or clear) a plan's Stripe Price ID from the admin — no redeploy.
  app.put("/admin/pricing/:plan", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { plan } = req.params as { plan: string };
    if (!PLANS.includes(plan as (typeof PLANS)[number])) {
      return reply.code(400).send({ error: "unknown_plan" });
    }
    const { stripePriceId } = z
      .object({ stripePriceId: z.string().trim() })
      .parse(req.body);
    if (!stripePriceId) {
      await prisma.planPrice.deleteMany({ where: { plan } });
      return { plan, stripePriceId: null };
    }
    const saved = await prisma.planPrice.upsert({
      where: { plan },
      update: { stripePriceId },
      create: { plan, stripePriceId },
    });
    return { plan, stripePriceId: saved.stripePriceId };
  });

  // A workspace's retrieval history (usage over the last months) for the admin.
  app.get("/admin/workspaces/:workspaceId/usage", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { workspaceId } = req.params as { workspaceId: string };
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organizationId: true, organization: { select: { plan: true } } },
    });
    const plan = ws?.organization.plan ?? "free";
    const history = ws ? await retrievalHistoryForOrg(ws.organizationId, 6) : [];
    return { plan, limit: planLimits(plan).retrievalsPerMonth, history };
  });

  // Set a workspace's (org's) plan (promote-for-free = plan + source "comp"). Logged.
  app.post("/admin/workspaces/:workspaceId/plan", async (req, reply) => {
    const admin = await requireAdmin(req, reply);
    if (!admin) return;
    const { workspaceId } = req.params as { workspaceId: string };
    const body = setPlanSchema.parse(req.body);

    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { organization: true },
    });
    if (!ws) return reply.code(404).send({ error: "Workspace not found" });
    const org = ws.organization;

    const updated = await prisma.organization.update({
      where: { id: org.id },
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
        organizationId: org.id,
        type: org.plan === body.plan ? "plan.changed" : "plan.granted",
        plan: body.plan,
        status: body.source === "comp" ? "comp" : null,
        note: body.note ?? null,
        actorEmail: admin.email,
        metadata: { from: org.plan, to: body.plan, source: body.source },
      },
    });

    return {
      id: workspaceId,
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
        organization: { select: { plan: true, planSource: true, planStatus: true, planNote: true } },
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
      plan: w.organization.plan,
      planSource: w.organization.planSource,
      planStatus: w.organization.planStatus,
      planNote: w.organization.planNote,
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
      include: { organization: { select: { name: true, slug: true } } },
    });
    // Keep the response shape stable for the admin UI (it reads `workspace`).
    return events.map((e) => ({ ...e, workspace: e.organization }));
  });
}
