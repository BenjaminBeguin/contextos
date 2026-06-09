import type { FastifyInstance } from "fastify";
import {
  createMemorySchema,
  updateMemorySchema,
  memoryListQuerySchema,
} from "@contextos/shared";
import { prisma } from "../db.js";
import { resolveUser, assertRepoAccess, HttpError, type AuthedUser } from "../auth.js";
import { searchMemories, writeAuditLog } from "../services/memory.js";

async function getMemoryWithAccess(userId: string, memoryId: string) {
  const memory = await prisma.memory.findUnique({
    where: { id: memoryId },
    include: { repo: true, evidence: true },
  });
  if (!memory) throw new HttpError(404, "Memory not found");
  await assertRepoAccess(userId, memory.repoId);
  return memory;
}

function handle(reply: import("fastify").FastifyReply, e: unknown) {
  if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
  throw e;
}

async function setStatus(
  user: AuthedUser,
  memoryId: string,
  status: string,
  action: string,
) {
  const memory = await getMemoryWithAccess(user.id, memoryId);
  const updated = await prisma.memory.update({ where: { id: memoryId }, data: { status } });
  await writeAuditLog({
    workspaceId: memory.repo.workspaceId,
    userId: user.id,
    action,
    entityType: "memory",
    entityId: memoryId,
    metadata: { from: memory.status, to: status },
  });
  return updated;
}

export async function memoryRoutes(app: FastifyInstance) {
  app.get("/repos/:repoId/memories", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      return handle(reply, e);
    }
    const q = memoryListQuerySchema.parse(req.query ?? {});
    if (q.search) {
      return searchMemories({ repoId, query: q.search, limit: 50 });
    }
    return prisma.memory.findMany({
      where: { repoId, status: q.status, type: q.type },
      orderBy: { updatedAt: "desc" },
      include: { evidence: true },
    });
  });

  app.post("/repos/:repoId/memories", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    let repo;
    try {
      repo = await assertRepoAccess(user.id, repoId);
    } catch (e) {
      return handle(reply, e);
    }
    const body = createMemorySchema.parse(req.body);
    const memory = await prisma.memory.create({
      data: {
        repoId,
        type: body.type,
        title: body.title,
        content: body.content,
        scope: body.scope,
        confidence: body.confidence,
        status: body.status,
        source: body.source,
        evidence: body.evidence ? { create: body.evidence } : undefined,
      },
      include: { evidence: true },
    });
    await writeAuditLog({
      workspaceId: repo.workspaceId,
      userId: user.id,
      action: "memory.create",
      entityType: "memory",
      entityId: memory.id,
      metadata: { status: memory.status },
    });
    return reply.code(201).send(memory);
  });

  app.patch("/memories/:memoryId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { memoryId } = req.params as { memoryId: string };
    let memory;
    try {
      memory = await getMemoryWithAccess(user.id, memoryId);
    } catch (e) {
      return handle(reply, e);
    }
    const body = updateMemorySchema.parse(req.body);
    const updated = await prisma.memory.update({
      where: { id: memoryId },
      data: body,
      include: { evidence: true },
    });
    await writeAuditLog({
      workspaceId: memory.repo.workspaceId,
      userId: user.id,
      action: "memory.update",
      entityType: "memory",
      entityId: memoryId,
      metadata: body,
    });
    return updated;
  });

  for (const [path, status, action] of [
    ["approve", "approved", "memory.approve"],
    ["reject", "rejected", "memory.reject"],
    ["archive", "archived", "memory.archive"],
  ] as const) {
    app.post(`/memories/:memoryId/${path}`, async (req, reply) => {
      const user = await resolveUser(req);
      if (!user) return reply.code(401).send({ error: "Unauthorized" });
      const { memoryId } = req.params as { memoryId: string };
      try {
        return await setStatus(user, memoryId, status, action);
      } catch (e) {
        return handle(reply, e);
      }
    });
  }
}
