import type { FastifyInstance } from "fastify";
import {
  createMemorySchema,
  updateMemorySchema,
  memoryListQuerySchema,
  proposeMemoriesSchema,
} from "@memmo/shared";
import { resolveUser, assertRepoAccess, requireRepoRole, HttpError, type AuthedUser } from "../auth.js";
import { searchMemories, writeAuditLog, getAutoThresholds, statusFor } from "../services/memory.js";
import { recordUsage } from "../services/analytics.js";
import { loadDedupSet, partitionNew, findDuplicate, similarity, DUP_THRESHOLD } from "../services/dedup.js";
import { memoryStoreForRepo, resolveMemoryById } from "../services/memoryStore.js";
import { splitMemory } from "../services/split.js";
import { getWorkspaceKey } from "../services/llm.js";
import { memoryHealth } from "../services/memoryHealth.js";

/** Resolve a memory by id (BYODB-aware) and enforce access. Writes
    (approve/reject/edit) require member+; reads only require access. */
async function getMemoryWithAccess(userId: string, memoryId: string, write = false) {
  const resolved = await resolveMemoryById(userId, memoryId);
  if (!resolved) throw new HttpError(404, "Memory not found");
  if (write) await requireRepoRole(userId, resolved.repoId, "member");
  else await assertRepoAccess(userId, resolved.repoId);
  return resolved;
}

function handle(reply: import("fastify").FastifyReply, e: unknown) {
  if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
  throw e;
}

async function setStatus(user: AuthedUser, memoryId: string, status: string, action: string) {
  const { memory, store, workspaceId, repoId } = await getMemoryWithAccess(user.id, memoryId, true);
  const updated = await store.setStatus(memoryId, status);
  await writeAuditLog({
    workspaceId,
    userId: user.id,
    action,
    entityType: "memory",
    entityId: memoryId,
    metadata: { from: memory.status, to: status },
  });
  let superseded = 0;
  if (status === "approved") {
    await recordUsage("memory.approved", { workspaceId, repoId });
    // Approving a memory supersedes any older approved memory that says the same
    // thing — archive the duplicates so only the latest stays canonical.
    const others = (await store.listByRepo(repoId, { status: "approved" })).filter(
      (o) => o.id !== memoryId,
    );
    const dups = others.filter((o) => similarity(o, memory) >= DUP_THRESHOLD);
    if (dups.length > 0) {
      await store.archiveMany(dups.map((d) => d.id));
      for (const d of dups) {
        await writeAuditLog({
          workspaceId,
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
    const { store } = await memoryStoreForRepo(repoId);
    const memories = await store.listByRepo(repoId, { status: q.status, type: q.type });

    // Flag proposed memories that look like an existing approved memory, so a
    // reviewer can supersede instead of creating a duplicate.
    const proposed = memories.filter((m) => m.status === "proposed");
    if (proposed.length === 0) return memories;
    const approved = await store.listByRepo(repoId, { status: "approved" });
    return memories.map((m) => {
      if (m.status !== "proposed") return m;
      const dup = findDuplicate(approved, m, 0.45);
      return dup ? { ...m, duplicateOf: { id: dup.id, title: dup.title } } : m;
    });
  });

  // Corpus health for a repo: stale (aging-out) approved memories and pairs of
  // memories that duplicate or contradict each other, so a reviewer can prune.
  app.get("/repos/:repoId/memory-health", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      return handle(reply, e);
    }
    const { store } = await memoryStoreForRepo(repoId);
    const memories = await store.listByRepo(repoId);
    return memoryHealth(memories, new Date());
  });

  app.post("/repos/:repoId/memories", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    let repo;
    try {
      repo = await requireRepoRole(user.id, repoId, "member");
    } catch (e) {
      return handle(reply, e);
    }
    const body = createMemorySchema.parse(req.body);
    const { store } = await memoryStoreForRepo(repoId);
    const memory = await store.create({
      repoId,
      workspaceId: repo.workspaceId,
      type: body.type,
      title: body.title,
      content: body.content,
      paths: body.paths ?? [],
      scope: body.scope,
      confidence: body.confidence,
      status: body.status,
      source: body.source,
      evidence: body.evidence,
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
    const thresholds = await getAutoThresholds(repo.workspaceId);
    const { store } = await memoryStoreForRepo(repoId);
    let autoApproved = 0;
    let autoRejected = 0;
    let proposedCount = 0;
    for (const m of fresh) {
      const status = statusFor(thresholds, m.confidence);
      if (status === "approved") autoApproved++;
      else if (status === "rejected") autoRejected++;
      else proposedCount++;
      await store.create({
        repoId,
        workspaceId: repo.workspaceId,
        type: m.type,
        title: m.title,
        content: m.content,
        paths: m.paths ?? [],
        scope: "repo",
        confidence: m.confidence,
        status,
        source: "claude_code",
        evidence: m.evidence ? [{ kind: "agent", content: m.evidence }] : undefined,
      });
    }
    await recordUsage("memory.created", {
      workspaceId: repo.workspaceId,
      repoId,
      metadata: { count: fresh.length, skipped, autoApproved, autoRejected, via: "agent" },
    });
    return reply.code(201).send({ proposedCount, skipped, autoApproved, autoRejected });
  });

  app.patch("/memories/:memoryId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { memoryId } = req.params as { memoryId: string };
    let resolved;
    try {
      resolved = await getMemoryWithAccess(user.id, memoryId, true);
    } catch (e) {
      return handle(reply, e);
    }
    const body = updateMemorySchema.parse(req.body);
    const updated = await resolved.store.update(memoryId, body);
    await writeAuditLog({
      workspaceId: resolved.workspaceId,
      userId: user.id,
      action: "memory.update",
      entityType: "memory",
      entityId: memoryId,
      metadata: body,
    });
    return updated;
  });

  // Split a long memory into several atomic, concise memories (archives the original).
  app.post("/memories/:memoryId/split", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { memoryId } = req.params as { memoryId: string };
    let resolved;
    try {
      resolved = await getMemoryWithAccess(user.id, memoryId, true);
    } catch (e) {
      return handle(reply, e);
    }
    const { memory, store, workspaceId, repoId } = resolved;
    const apiKey = await getWorkspaceKey(workspaceId);
    const parts = await splitMemory(
      {
        type: memory.type,
        title: memory.title,
        content: memory.content,
        paths: memory.paths,
        confidence: memory.confidence,
      },
      apiKey,
    );
    if (parts.length <= 1) {
      return reply.code(400).send({ error: "Nothing to split — this memory is already atomic." });
    }
    for (const p of parts) {
      await store.create({
        repoId,
        workspaceId,
        type: p.type,
        title: p.title.slice(0, 140),
        content: p.content,
        paths: p.paths ?? memory.paths,
        scope: "repo",
        confidence: p.confidence,
        status: "proposed",
        source: "split",
      });
    }
    await store.setStatus(memoryId, "archived");
    await writeAuditLog({
      workspaceId,
      userId: user.id,
      action: "memory.split",
      entityType: "memory",
      entityId: memoryId,
      metadata: { into: parts.length },
    });
    return reply.code(201).send({ created: parts.length });
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
