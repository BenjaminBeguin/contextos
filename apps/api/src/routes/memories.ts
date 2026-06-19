import type { FastifyInstance } from "fastify";
import {
  createMemorySchema,
  updateMemorySchema,
  memoryListQuerySchema,
  proposeMemoriesSchema,
} from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertRepoAccess, HttpError, type AuthedUser } from "../auth.js";
import { searchMemories, writeAuditLog } from "../services/memory.js";
import { recordUsage } from "../services/analytics.js";
import { loadDedupSet, partitionNew, findDuplicate, similarity, DUP_THRESHOLD } from "../services/dedup.js";

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
  let superseded = 0;
  if (status === "approved") {
    await recordUsage("memory.approved", {
      workspaceId: memory.repo.workspaceId,
      repoId: memory.repoId,
    });
    // Approving a memory supersedes any older approved memory that says the same
    // thing — archive the duplicates so only the latest stays canonical.
    const others = await prisma.memory.findMany({
      where: { repoId: memory.repoId, status: "approved", id: { not: memoryId } },
      select: { id: true, type: true, title: true, content: true },
    });
    const dups = others.filter((o) => similarity(o, memory) >= DUP_THRESHOLD);
    if (dups.length > 0) {
      await prisma.memory.updateMany({
        where: { id: { in: dups.map((d) => d.id) } },
        data: { status: "archived" },
      });
      for (const d of dups) {
        await writeAuditLog({
          workspaceId: memory.repo.workspaceId,
          userId: user.id,
          action: "memory.superseded",
          entityType: "memory",
          entityId: d.id,
          metadata: { supersededBy: memoryId },
        });
      }
      superseded = dups.length;
    }
  }
  return { ...updated, superseded };
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
    const memories = await prisma.memory.findMany({
      where: { repoId, status: q.status, type: q.type },
      orderBy: { updatedAt: "desc" },
      include: { evidence: true },
    });

    // Flag proposed memories that look like an existing approved memory, so a
    // reviewer can supersede instead of creating a duplicate.
    const proposed = memories.filter((m) => m.status === "proposed");
    if (proposed.length === 0) return memories;
    const approved = await prisma.memory.findMany({
      where: { repoId, status: "approved" },
      select: { id: true, type: true, title: true, content: true, status: true },
    });
    return memories.map((m) => {
      if (m.status !== "proposed") return m;
      const dup = findDuplicate(approved, m, 0.45);
      return dup ? { ...m, duplicateOf: { id: dup.id, title: dup.title } } : m;
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
        paths: body.paths ?? [],
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
    await recordUsage("memory.created", {
      workspaceId: repo.workspaceId,
      repoId: repo.id,
      metadata: { type: memory.type, status: memory.status },
    });
    return reply.code(201).send(memory);
  });

  // Batch-propose memories from the agent (Claude Code via MCP) — uses the
  // user's own Claude, no server LLM. Lands in the inbox for review.
  app.post("/repos/:repoId/proposals", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    let repo;
    try {
      repo = await assertRepoAccess(user.id, repoId);
    } catch (e) {
      return handle(reply, e);
    }
    const body = proposeMemoriesSchema.parse(req.body);
    // Skip near-duplicates of existing proposed/approved memories so the inbox
    // doesn't fill with repeats (the SessionEnd hook proposes every session).
    const existing = await loadDedupSet(repoId);
    const { fresh, skipped } = partitionNew(existing, body.memories);
    await prisma.$transaction(
      fresh.map((m) =>
        prisma.memory.create({
          data: {
            repoId,
            type: m.type,
            title: m.title,
            content: m.content,
            paths: m.paths ?? [],
            scope: "repo",
            confidence: m.confidence,
            status: "proposed",
            source: "claude_code",
            evidence: m.evidence ? { create: [{ kind: "agent", content: m.evidence }] } : undefined,
          },
        }),
      ),
    );
    await recordUsage("memory.created", {
      workspaceId: repo.workspaceId,
      repoId,
      metadata: { count: fresh.length, skipped, via: "agent" },
    });
    return reply.code(201).send({ proposedCount: fresh.length, skipped });
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
