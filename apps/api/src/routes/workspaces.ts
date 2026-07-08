import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  createWorkspaceSchema,
  joinWorkspaceSchema,
  updateWorkspaceSchema,
  inviteMemberSchema,
  setMemberRoleSchema,
  reviewerSkillSchema,
  updateReviewerSkillSchema,
  billingCheckoutSchema,
  requestUpgradeSchema,
  dataStoreSchema,
  planLimits,
  withinLimit,
} from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, requireRole, HttpError } from "../auth.js";
import { encryptToken } from "../crypto.js";
import { env } from "../env.js";
import { getAutoThresholds } from "../services/memory.js";
import { memoryStore } from "../services/memoryStore.js";
import { testConnection, provisionExternalStore, dropExternalClient } from "../services/dataStore.js";
import { createCheckoutSession } from "../services/stripe.js";
import { retrievalUsage } from "../services/retrievals.js";

function generateJoinCode(): string {
  // Human-friendly, unambiguous join code, e.g. "WS-7F3K9Q".
  return `WS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function workspaceRoutes(app: FastifyInstance) {
  // Search memories across every repo in the workspace.
  app.get("/workspaces/:workspaceId/memories", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await assertWorkspaceAccess(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { search, status, type } = req.query as {
      search?: string;
      status?: string;
      type?: string;
    };
    const repos = await prisma.repo.findMany({
      where: { workspaceId },
      select: { id: true, fullName: true },
    });
    const repoName = new Map(repos.map((r) => [r.id, r.fullName]));

    // Routed through the workspace's memory store (BYODB projects read their own DB).
    const store = await memoryStore(workspaceId);
    let memories = await store.listByRepos(
      repos.map((r) => r.id),
      { status, type },
    );
    const q = (search ?? "").trim().toLowerCase();
    if (q) {
      memories = memories.filter(
        (m) => m.title.toLowerCase().includes(q) || m.content.toLowerCase().includes(q),
      );
    }
    memories = memories
      .sort((a, b) => b.confidence - a.confidence || +b.updatedAt - +a.updatedAt)
      .slice(0, 100);
    return memories.map((m) => ({ ...m, repoFullName: repoName.get(m.repoId) ?? "" }));
  });

  // All agent sessions across the project's repos (for the project Sessions tab).
  app.get("/workspaces/:workspaceId/sessions", async (req, reply) => {
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
      select: { id: true, fullName: true },
    });
    const repoName = new Map(repos.map((r) => [r.id, r.fullName]));
    const sessions = await prisma.agentSession.findMany({
      where: { repoId: { in: repos.map((r) => r.id) } },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: { _count: { select: { events: true } } },
    });
    return sessions.map((s) => ({ ...s, repoFullName: repoName.get(s.repoId) ?? "" }));
  });

  // All generated docs across the project's repos (for the project Docs tab).
  app.get("/workspaces/:workspaceId/docs", async (req, reply) => {
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
      select: { id: true, fullName: true },
    });
    const repoName = new Map(repos.map((r) => [r.id, r.fullName]));
    const docs = await prisma.generatedDoc.findMany({
      where: { repoId: { in: repos.map((r) => r.id) } },
      orderBy: { updatedAt: "desc" },
    });
    return docs.map((d) => ({ ...d, repoFullName: repoName.get(d.repoId) ?? "" }));
  });

  app.get("/workspaces", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });
    const wsIds = memberships.map((m) => m.workspaceId);
    const repos = await prisma.repo.findMany({
      where: { workspaceId: { in: wsIds } },
      select: { id: true, workspaceId: true },
    });
    const repoToWs = new Map(repos.map((r) => [r.id, r.workspaceId]));
    const repoCount = new Map<string, number>();
    for (const r of repos) repoCount.set(r.workspaceId, (repoCount.get(r.workspaceId) ?? 0) + 1);

    const proposed = await prisma.memory.groupBy({
      by: ["repoId"],
      where: { status: "proposed", repoId: { in: repos.map((r) => r.id) } },
      _count: true,
    });
    const pending = new Map<string, number>();
    for (const g of proposed) {
      const ws = repoToWs.get(g.repoId);
      if (ws) pending.set(ws, (pending.get(ws) ?? 0) + g._count);
    }
    // BYODB workspaces keep their memories in the customer DB — count there.
    for (const m of memberships) {
      if (m.workspace.externalDbStatus !== "connected") continue;
      const store = await memoryStore(m.workspaceId);
      const repoIds = repos.filter((r) => r.workspaceId === m.workspaceId).map((r) => r.id);
      pending.set(m.workspaceId, await store.countByRepos(repoIds, { status: "proposed" }));
    }

    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      joinCode: m.workspace.joinCode,
      role: m.role,
      repoCount: repoCount.get(m.workspaceId) ?? 0,
      pendingMemories: pending.get(m.workspaceId) ?? 0,
    }));
  });

  app.post("/workspaces", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = createWorkspaceSchema.parse(req.body);
    const workspace = await prisma.workspace.create({
      data: { name: body.name, slug: body.slug, joinCode: generateJoinCode() },
    });
    await prisma.membership.create({
      data: { userId: user.id, workspaceId: workspace.id, role: "owner" },
    });
    return workspace;
  });

  // Join an existing workspace using its join code.
  app.post("/workspaces/join", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = joinWorkspaceSchema.parse(req.body);
    const workspace = await prisma.workspace.findUnique({ where: { joinCode: body.joinCode } });
    if (!workspace) return reply.code(404).send({ error: "Invalid join code" });

    const existing = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: user.id, workspaceId: workspace.id } },
    });
    if (!existing) {
      await prisma.membership.create({
        data: { userId: user.id, workspaceId: workspace.id, role: "member" },
      });
    }
    return { id: workspace.id, name: workspace.name, slug: workspace.slug };
  });

  // Re-apply the saved confidence band to all currently-proposed memories (owners only).
  app.post("/workspaces/:workspaceId/triage", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      const membership = await assertWorkspaceAccess(user.id, workspaceId);
      if (membership.role !== "owner") throw new HttpError(403, "Only owners can re-triage");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const t = await getAutoThresholds(workspaceId);
    if (t.approve == null && t.reject == null) {
      return reply.code(400).send({ error: "Set an auto-approve or auto-reject threshold first." });
    }
    const repos = await prisma.repo.findMany({ where: { workspaceId }, select: { id: true } });
    const repoIds = repos.map((r) => r.id);
    const store = await memoryStore(workspaceId);

    // Approve takes precedence: approve first (those leave 'proposed'), then reject the rest.
    let approved = 0;
    let rejected = 0;
    if (store.external) {
      // BYODB: iterate the customer DB's proposed memories.
      for (const m of await store.listByRepos(repoIds, { status: "proposed" })) {
        if (t.approve != null && m.confidence >= t.approve) {
          await store.setStatus(m.id, "approved");
          approved++;
        } else if (t.reject != null && m.confidence < t.reject) {
          await store.setStatus(m.id, "rejected");
          rejected++;
        }
      }
    } else {
      if (t.approve != null) {
        const r = await prisma.memory.updateMany({
          where: { repoId: { in: repoIds }, status: "proposed", confidence: { gte: t.approve } },
          data: { status: "approved" },
        });
        approved = r.count;
      }
      if (t.reject != null) {
        const r = await prisma.memory.updateMany({
          where: { repoId: { in: repoIds }, status: "proposed", confidence: { lt: t.reject } },
          data: { status: "rejected" },
        });
        rejected = r.count;
      }
    }
    const kept = await store.countByRepos(repoIds, { status: "proposed" });
    return { approved, rejected, kept };
  });

  // Add an existing Cortex user to the workspace by email (owners only).
  app.post("/workspaces/:workspaceId/members", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await requireRole(user.id, workspaceId, "admin");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = inviteMemberSchema.parse(req.body);
    const target = await prisma.user.findFirst({
      where: { email: { equals: body.email, mode: "insensitive" } },
    });
    if (!target) {
      return reply.code(404).send({
        error: "No Cortex account with that email yet. Share the join code so they can sign up and join.",
      });
    }
    const existing = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId: target.id, workspaceId } },
    });
    if (existing) return reply.code(409).send({ error: "Already a member." });
    // Seats are unlimited on every tier — invite freely.
    await prisma.membership.create({
      data: { userId: target.id, workspaceId, role: body.role },
    });
    return reply.code(201).send({ ok: true });
  });

  // Change a member's role (owners only; can't demote the last owner).
  app.patch("/workspaces/:workspaceId/members/:userId/role", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId, userId } = req.params as { workspaceId: string; userId: string };
    try {
      await requireRole(user.id, workspaceId, "owner");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = setMemberRoleSchema.parse(req.body);
    const target = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!target) return reply.code(404).send({ error: "Not a member." });
    // Never leave the workspace without an owner.
    if (target.role === "owner" && body.role !== "owner") {
      const owners = await prisma.membership.count({ where: { workspaceId, role: "owner" } });
      if (owners <= 1) return reply.code(400).send({ error: "Can't demote the last owner." });
    }
    await prisma.membership.update({
      where: { userId_workspaceId: { userId, workspaceId } },
      data: { role: body.role },
    });
    return { ok: true, role: body.role };
  });

  // Remove a member from the workspace (admin+; never the last owner).
  app.delete("/workspaces/:workspaceId/members/:userId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId, userId } = req.params as { workspaceId: string; userId: string };
    try {
      await requireRole(user.id, workspaceId, "admin");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const target = await prisma.membership.findUnique({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    if (!target) return reply.code(404).send({ error: "Not a member." });
    if (target.role === "owner") {
      const owners = await prisma.membership.count({ where: { workspaceId, role: "owner" } });
      if (owners <= 1) return reply.code(400).send({ error: "Can't remove the last owner." });
    }
    await prisma.membership.delete({
      where: { userId_workspaceId: { userId, workspaceId } },
    });
    return { ok: true };
  });

  app.get("/workspaces/:workspaceId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await assertWorkspaceAccess(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      include: {
        repos: { include: { _count: { select: { memories: true } } } },
        memberships: {
          include: { user: { select: { id: true, email: true, name: true, avatarUrl: true } } },
        },
      },
    });
    if (!workspace) return reply.code(404).send({ error: "Workspace not found" });

    // BYODB: memory counts come from the customer's DB, not the shared _count.
    const store = await memoryStore(workspaceId);
    const repoIds = workspace.repos.map((r) => r.id);
    let repos = workspace.repos as Array<
      (typeof workspace.repos)[number] & { _count: { memories: number } }
    >;
    let pendingMemories: number;
    if (store.external) {
      const all = await store.listByRepos(repoIds);
      const perRepo = new Map<string, number>();
      for (const m of all) perRepo.set(m.repoId, (perRepo.get(m.repoId) ?? 0) + 1);
      repos = workspace.repos.map((r) => ({ ...r, _count: { memories: perRepo.get(r.id) ?? 0 } }));
      pendingMemories = all.filter((m) => m.status === "proposed").length;
    } else {
      pendingMemories = await prisma.memory.count({
        where: { status: "proposed", repo: { workspaceId } },
      });
    }

    // Never return the encrypted key or DB URL — just whether each is set.
    const { anthropicKey, ...rest } = workspace;
    delete (rest as { externalDbUrl?: string | null }).externalDbUrl;
    const limits = planLimits(workspace.plan);
    const retrievals = await retrievalUsage(workspaceId, workspace.plan);
    return {
      ...rest,
      repos,
      hasAnthropicKey: Boolean(anthropicKey),
      pendingMemories,
      limits,
      usage: { repos: workspace.repos.length, seats: workspace.memberships.length },
      retrievals,
      billingEnabled: env.stripe.enabled,
      dataStore: {
        status: workspace.externalDbStatus,
        configured: workspace.externalDbStatus === "connected",
        checkedAt: workspace.externalDbCheckedAt,
        error: workspace.externalDbError,
      },
    };
  });

  // --- Bring-your-own-database (data residency, Enterprise) ---------------

  // Connect the workspace's own Postgres: validate the URL, provision the
  // memory table, and flip status to connected. Owner-only, Enterprise-gated.
  app.put("/workspaces/:workspaceId/data-store", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await requireRole(user.id, workspaceId, "owner");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { plan: true },
    });
    if (!planLimits(ws?.plan ?? "free").byodb) {
      return reply.code(402).send({ error: "plan_limit_byodb" });
    }
    const body = dataStoreSchema.parse(req.body);

    const test = await testConnection(body.url);
    if (!test.ok) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { externalDbStatus: "error", externalDbError: test.error, externalDbCheckedAt: new Date() },
      });
      return reply.code(400).send({ error: "connection_failed", detail: test.error });
    }
    const prov = await provisionExternalStore(body.url);
    if (!prov.ok) {
      await prisma.workspace.update({
        where: { id: workspaceId },
        data: { externalDbStatus: "error", externalDbError: prov.error, externalDbCheckedAt: new Date() },
      });
      return reply.code(400).send({ error: "provision_failed", detail: prov.error });
    }
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        externalDbUrl: encryptToken(body.url),
        externalDbStatus: "connected",
        externalDbError: null,
        externalDbCheckedAt: new Date(),
      },
    });
    await prisma.billingEvent.create({
      data: {
        workspaceId,
        type: "datastore.connected",
        status: "active",
        note: "External database connected",
        actorEmail: user.email,
      },
    });
    return { status: "connected" };
  });

  // Re-test the currently configured connection.
  app.post("/workspaces/:workspaceId/data-store/test", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await requireRole(user.id, workspaceId, "owner");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { externalDbUrl: true },
    });
    if (!ws?.externalDbUrl) return reply.code(400).send({ error: "not_configured" });
    const { decryptToken } = await import("../crypto.js");
    const url = decryptToken(ws.externalDbUrl);
    if (!url) return reply.code(400).send({ error: "not_configured" });
    const test = await testConnection(url);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        externalDbStatus: test.ok ? "connected" : "error",
        externalDbError: test.ok ? null : test.error,
        externalDbCheckedAt: new Date(),
      },
    });
    return { ok: test.ok, error: test.error };
  });

  // Disconnect: stop routing to the customer DB (their data stays in their DB).
  app.delete("/workspaces/:workspaceId/data-store", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await requireRole(user.id, workspaceId, "owner");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { externalDbUrl: true },
    });
    if (ws?.externalDbUrl) await dropExternalClient(ws.externalDbUrl);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        externalDbUrl: null,
        externalDbStatus: "unconfigured",
        externalDbError: null,
        externalDbCheckedAt: null,
      },
    });
    return { status: "unconfigured" };
  });

  // This workspace's billing history (owners) — plan grants/changes, upgrade
  // requests, and (once Stripe is wired) invoices.
  app.get("/workspaces/:workspaceId/billing-events", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await requireRole(user.id, workspaceId, "owner");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    return prisma.billingEvent.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
  });

  // Owner requests an upgrade when self-serve billing is off — logged as a
  // BillingEvent the admin sees (they can then comp/upgrade). No Stripe needed.
  app.post("/workspaces/:workspaceId/request-upgrade", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      const membership = await assertWorkspaceAccess(user.id, workspaceId);
      if (membership.role !== "owner") throw new HttpError(403, "Only owners can request an upgrade");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = requestUpgradeSchema.parse(req.body);
    await prisma.billingEvent.create({
      data: {
        workspaceId,
        type: "upgrade.requested",
        plan: body.plan,
        status: "requested",
        note: body.note ?? null,
        actorEmail: user.email,
      },
    });
    return { ok: true };
  });

  // Start a self-serve upgrade (owners only). Returns a Stripe Checkout URL once
  // billing is configured; until then reports that self-serve billing is off.
  app.post("/workspaces/:workspaceId/billing/checkout", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      const membership = await assertWorkspaceAccess(user.id, workspaceId);
      if (membership.role !== "owner") throw new HttpError(403, "Only owners can manage billing");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = billingCheckoutSchema.parse(req.body);
    if (!env.stripe.enabled) {
      return reply.code(501).send({
        error: "billing_not_configured",
        message:
          "Self-serve billing isn't enabled yet. An admin can comp your plan, or set STRIPE_SECRET_KEY to turn on checkout.",
      });
    }
    try {
      const { url } = await createCheckoutSession({ workspaceId, plan: body.plan, email: user.email });
      return { url };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "checkout_failed";
      if (msg === "price_not_configured") {
        return reply.code(400).send({
          error: "price_not_configured",
          message: `No Stripe price is configured for the ${body.plan} plan. Set STRIPE_PRICE_${body.plan.toUpperCase()}.`,
        });
      }
      return reply.code(400).send({ error: "checkout_failed", message: msg });
    }
  });

  // Update workspace settings — name and/or auto-approve threshold (owners only).
  app.patch("/workspaces/:workspaceId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      const membership = await assertWorkspaceAccess(user.id, workspaceId);
      if (membership.role !== "owner") throw new HttpError(403, "Only owners can edit the workspace");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = updateWorkspaceSchema.parse(req.body);
    const data: {
      name?: string;
      autoApproveThreshold?: number | null;
      autoRejectThreshold?: number | null;
    } = {};
    if (body.name !== undefined) data.name = body.name;
    if (body.autoApproveThreshold !== undefined) data.autoApproveThreshold = body.autoApproveThreshold;
    if (body.autoRejectThreshold !== undefined) data.autoRejectThreshold = body.autoRejectThreshold;
    const ws = await prisma.workspace.update({
      where: { id: workspaceId },
      data,
      select: {
        id: true,
        name: true,
        slug: true,
        joinCode: true,
        autoApproveThreshold: true,
        autoRejectThreshold: true,
      },
    });
    return ws;
  });

  // Set or clear this workspace's Anthropic API key (BYOK, owners only).
  app.put("/workspaces/:workspaceId/anthropic-key", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      const membership = await assertWorkspaceAccess(user.id, workspaceId);
      if (membership.role !== "owner") throw new HttpError(403, "Only owners can set the API key");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const { key } = (req.body ?? {}) as { key?: string };
    const trimmed = key?.trim();
    if (!trimmed) return reply.code(400).send({ error: "Missing key" });
    if (!trimmed.startsWith("sk-ant-")) {
      return reply.code(400).send({ error: "That doesn't look like an Anthropic API key (sk-ant-…)" });
    }
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { anthropicKey: encryptToken(trimmed) },
    });
    return { ok: true, hasAnthropicKey: true };
  });

  app.delete("/workspaces/:workspaceId/anthropic-key", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      const membership = await assertWorkspaceAccess(user.id, workspaceId);
      if (membership.role !== "owner") throw new HttpError(403, "Only owners can remove the API key");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    await prisma.workspace.update({ where: { id: workspaceId }, data: { anthropicKey: null } });
    return { ok: true, hasAnthropicKey: false };
  });

  // Rotate the join code (owners only) — invalidates the old one.
  app.post("/workspaces/:workspaceId/rotate-join-code", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      const membership = await assertWorkspaceAccess(user.id, workspaceId);
      if (membership.role !== "owner") throw new HttpError(403, "Only owners can rotate the code");
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: { joinCode: generateJoinCode() },
    });
    return { joinCode: updated.joinCode };
  });

  // List reusable reviewer skills for a workspace.
  app.get("/workspaces/:workspaceId/reviewer-skills", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await assertWorkspaceAccess(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    return prisma.reviewerSkill.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "asc" },
    });
  });

  // Create a reusable reviewer skill (any member).
  app.post("/workspaces/:workspaceId/reviewer-skills", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await assertWorkspaceAccess(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = reviewerSkillSchema.parse(req.body);
    return prisma.reviewerSkill.create({
      data: {
        workspaceId,
        name: body.name,
        instructions: body.instructions,
        paths: body.paths ?? [],
      },
    });
  });

  // Update a reviewer skill.
  app.patch("/reviewer-skills/:skillId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { skillId } = req.params as { skillId: string };
    const skill = await prisma.reviewerSkill.findUnique({ where: { id: skillId } });
    if (!skill) return reply.code(404).send({ error: "Skill not found" });
    try {
      await assertWorkspaceAccess(user.id, skill.workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = updateReviewerSkillSchema.parse(req.body);
    return prisma.reviewerSkill.update({ where: { id: skillId }, data: body });
  });

  // Delete a reviewer skill (also detaches it from every repo).
  app.delete("/reviewer-skills/:skillId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { skillId } = req.params as { skillId: string };
    const skill = await prisma.reviewerSkill.findUnique({ where: { id: skillId } });
    if (!skill) return reply.code(404).send({ error: "Skill not found" });
    try {
      await assertWorkspaceAccess(user.id, skill.workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    await prisma.reviewerSkill.delete({ where: { id: skillId } });
    return { ok: true };
  });
}
