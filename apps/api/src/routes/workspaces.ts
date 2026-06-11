import { randomBytes } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  createWorkspaceSchema,
  joinWorkspaceSchema,
  updateWorkspaceSchema,
} from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, HttpError } from "../auth.js";

function generateJoinCode(): string {
  // Human-friendly, unambiguous join code, e.g. "WS-7F3K9Q".
  return `WS-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export async function workspaceRoutes(app: FastifyInstance) {
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
    return workspace;
  });

  // Rename a workspace (owners only).
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
    return prisma.workspace.update({ where: { id: workspaceId }, data: { name: body.name } });
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
