import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import {
  createWorkspaceSchema,
  joinWorkspaceSchema,
  updateWorkspaceSchema,
} from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, HttpError } from "../auth.js";
import { encryptToken } from "../crypto.js";

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

    const where: Prisma.MemoryWhereInput = { repoId: { in: repos.map((r) => r.id) } };
    if (status) where.status = status;
    if (type) where.type = type;
    const q = (search ?? "").trim();
    if (q) {
      where.OR = [
        { title: { contains: q, mode: "insensitive" } },
        { content: { contains: q, mode: "insensitive" } },
      ];
    }
    const memories = await prisma.memory.findMany({
      where,
      orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
      take: 100,
    });
    return memories.map((m) => ({ ...m, repoFullName: repoName.get(m.repoId) ?? "" }));
  });

  app.get("/workspaces", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const memberships = await prisma.membership.findMany({
      where: { userId: user.id },
      include: { workspace: true },
    });
    return memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      joinCode: m.workspace.joinCode,
      role: m.role,
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
    // Never return the (encrypted) key — just whether one is set.
    const { anthropicKey, ...rest } = workspace;
    return { ...rest, hasAnthropicKey: Boolean(anthropicKey) };
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
}
