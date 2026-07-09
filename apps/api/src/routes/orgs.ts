import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  createOrgSchema,
  updateOrgSchema,
  joinOrgSchema,
  inviteOrgMemberSchema,
  setOrgRoleSchema,
  createWorkspaceSchema,
  requestUpgradeSchema,
  billingCheckoutSchema,
  planLimits,
  type OrgRole,
} from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, HttpError } from "../auth.js";
import { requireOrgRole, orgRole } from "../services/orgs.js";
import { retrievalUsageForOrg, retrievalHistoryForOrg } from "../services/retrievals.js";
import { createCheckoutSession } from "../services/stripe.js";
import { env } from "../env.js";

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `${base || "org"}-${randomBytes(3).toString("hex")}`;
}

function joinCode(): string {
  return `WS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function orgJoinCode(): string {
  return `ORG-${randomBytes(4).toString("hex").toUpperCase()}`;
}

function handle(reply: import("fastify").FastifyReply, e: unknown) {
  if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
  throw e;
}

export async function orgRoutes(app: FastifyInstance) {
  // Every org the caller belongs to, with plan, role, and project count.
  app.get("/orgs", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const memberships = await prisma.orgMembership.findMany({
      where: { userId: user.id },
      include: {
        organization: {
          include: { _count: { select: { workspaces: true, members: true } } },
        },
      },
      orderBy: { organization: { createdAt: "asc" } },
    });
    return memberships.map((m) => ({
      id: m.organization.id,
      name: m.organization.name,
      slug: m.organization.slug,
      joinCode: m.organization.joinCode,
      plan: m.organization.plan,
      role: m.role,
      projectCount: m.organization._count.workspaces,
      memberCount: m.organization._count.members,
    }));
  });

  // Create a new organization; the caller becomes its owner.
  app.post("/orgs", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = createOrgSchema.parse(req.body);
    const org = await prisma.organization.create({
      data: {
        name: body.name,
        slug: slugify(body.name),
        joinCode: orgJoinCode(),
        members: { create: { userId: user.id, role: "owner" } },
      },
    });
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      joinCode: org.joinCode,
      plan: org.plan,
      role: "owner",
      projectCount: 0,
      memberCount: 1,
    };
  });

  // Join an existing organization with its share code; the caller becomes a member.
  app.post("/orgs/join", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = joinOrgSchema.parse(req.body);
    const org = await prisma.organization.findUnique({
      where: { joinCode: body.joinCode.trim() },
    });
    if (!org) return reply.code(404).send({ error: "Invalid join code" });
    const existing = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId: user.id, organizationId: org.id } },
    });
    if (!existing) {
      await prisma.orgMembership.create({
        data: { userId: user.id, organizationId: org.id, role: "member" },
      });
    }
    return { id: org.id, name: org.name, slug: org.slug, plan: org.plan, role: existing?.role ?? "member" };
  });

  // Org detail: plan, usage, projects, members. Any member can read.
  app.get("/orgs/:orgId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId } = req.params as { orgId: string };
    const role = await orgRole(user.id, orgId);
    if (!role) return reply.code(403).send({ error: "No access to this organization" });

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      include: {
        workspaces: {
          select: { id: true, name: true, slug: true, _count: { select: { repos: true, memberships: true } } },
          orderBy: { createdAt: "asc" },
        },
        members: {
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        },
      },
    });
    if (!org) return reply.code(404).send({ error: "Organization not found" });

    const usage = await retrievalUsageForOrg(orgId);
    return {
      id: org.id,
      name: org.name,
      slug: org.slug,
      joinCode: org.joinCode,
      plan: org.plan,
      planSource: org.planSource,
      planStatus: org.planStatus,
      role,
      limits: planLimits(org.plan),
      usage,
      billingEnabled: env.stripe.enabled,
      projects: org.workspaces.map((w) => ({
        id: w.id,
        name: w.name,
        slug: w.slug,
        repoCount: w._count.repos,
        memberCount: w._count.memberships,
      })),
      members: org.members.map((m) => ({
        userId: m.userId,
        role: m.role,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
      })),
    };
  });

  app.patch("/orgs/:orgId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId } = req.params as { orgId: string };
    try {
      await requireOrgRole(user.id, orgId, "admin");
    } catch (e) {
      return handle(reply, e);
    }
    const body = updateOrgSchema.parse(req.body);
    const org = await prisma.organization.update({ where: { id: orgId }, data: { name: body.name } });
    return { id: org.id, name: org.name };
  });

  // Create a project (workspace) inside the org. Admin+; the creator also gets
  // project ownership so existing project-level flows keep working.
  app.post("/orgs/:orgId/workspaces", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId } = req.params as { orgId: string };
    try {
      await requireOrgRole(user.id, orgId, "admin");
    } catch (e) {
      return handle(reply, e);
    }
    const body = createWorkspaceSchema.parse(req.body);
    const workspace = await prisma.workspace.create({
      data: {
        name: body.name,
        slug: `${body.slug}-${randomBytes(3).toString("hex")}`,
        joinCode: joinCode(),
        organizationId: orgId,
      },
    });
    await prisma.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: "owner" },
    });
    return { id: workspace.id, name: workspace.name, slug: workspace.slug };
  });

  // --- Org members ---------------------------------------------------------

  app.post("/orgs/:orgId/members", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId } = req.params as { orgId: string };
    try {
      await requireOrgRole(user.id, orgId, "admin");
    } catch (e) {
      return handle(reply, e);
    }
    const body = inviteOrgMemberSchema.parse(req.body);
    const target = await prisma.user.findUnique({ where: { email: body.email.toLowerCase() } });
    if (!target) {
      return reply.code(404).send({ error: "No Cortex account with that email yet." });
    }
    const existing = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId: target.id, organizationId: orgId } },
    });
    if (existing) return reply.code(409).send({ error: "Already a member." });
    await prisma.orgMembership.create({
      data: { userId: target.id, organizationId: orgId, role: body.role },
    });
    return reply.code(201).send({ ok: true });
  });

  app.patch("/orgs/:orgId/members/:userId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId, userId } = req.params as { orgId: string; userId: string };
    try {
      await requireOrgRole(user.id, orgId, "owner");
    } catch (e) {
      return handle(reply, e);
    }
    const body = setOrgRoleSchema.parse(req.body);
    // Don't allow removing the last owner.
    if (body.role !== "owner") {
      const owners = await prisma.orgMembership.count({ where: { organizationId: orgId, role: "owner" } });
      const current = await prisma.orgMembership.findUnique({
        where: { userId_organizationId: { userId, organizationId: orgId } },
      });
      if (current?.role === "owner" && owners <= 1) {
        return reply.code(400).send({ error: "Can't demote the last owner." });
      }
    }
    await prisma.orgMembership.update({
      where: { userId_organizationId: { userId, organizationId: orgId } },
      data: { role: body.role as OrgRole },
    });
    return { ok: true };
  });

  app.delete("/orgs/:orgId/members/:userId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId, userId } = req.params as { orgId: string; userId: string };
    try {
      await requireOrgRole(user.id, orgId, "admin");
    } catch (e) {
      return handle(reply, e);
    }
    const target = await prisma.orgMembership.findUnique({
      where: { userId_organizationId: { userId, organizationId: orgId } },
    });
    if (target?.role === "owner") {
      const owners = await prisma.orgMembership.count({ where: { organizationId: orgId, role: "owner" } });
      if (owners <= 1) return reply.code(400).send({ error: "Can't remove the last owner." });
    }
    await prisma.orgMembership.deleteMany({ where: { userId, organizationId: orgId } });
    return { ok: true };
  });

  // --- Org billing ---------------------------------------------------------

  app.get("/orgs/:orgId/usage", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId } = req.params as { orgId: string };
    if (!(await orgRole(user.id, orgId))) return reply.code(403).send({ error: "No access" });
    const [usage, history] = await Promise.all([
      retrievalUsageForOrg(orgId),
      retrievalHistoryForOrg(orgId, 6),
    ]);
    return { usage, history };
  });

  app.get("/orgs/:orgId/billing-events", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId } = req.params as { orgId: string };
    try {
      await requireOrgRole(user.id, orgId, "admin");
    } catch (e) {
      return handle(reply, e);
    }
    return prisma.billingEvent.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  app.post("/orgs/:orgId/request-upgrade", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId } = req.params as { orgId: string };
    try {
      await requireOrgRole(user.id, orgId, "admin");
    } catch (e) {
      return handle(reply, e);
    }
    const body = requestUpgradeSchema.parse(req.body);
    await prisma.billingEvent.create({
      data: {
        organizationId: orgId,
        type: "upgrade.requested",
        plan: body.plan,
        status: "requested",
        note: body.note ?? null,
        actorEmail: user.email,
      },
    });
    return { ok: true };
  });

  app.post("/orgs/:orgId/billing/checkout", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { orgId } = req.params as { orgId: string };
    try {
      await requireOrgRole(user.id, orgId, "admin");
    } catch (e) {
      return handle(reply, e);
    }
    const body = billingCheckoutSchema.parse(req.body);
    if (!env.stripe.enabled) {
      return reply.code(501).send({
        error: "billing_not_configured",
        message: "Self-serve billing isn't enabled yet. An admin can comp your plan.",
      });
    }
    try {
      const { url } = await createCheckoutSession({ organizationId: orgId, plan: body.plan, email: user.email });
      return { url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "checkout_failed";
      if (msg === "price_not_configured") {
        return reply.code(400).send({ error: "price_not_configured" });
      }
      return reply.code(400).send({ error: "checkout_failed", message: msg });
    }
  });
}
