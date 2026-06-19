import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { recordSessionSchema } from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertRepoAccess, HttpError } from "../auth.js";
import { extractMemories } from "../services/extract.js";
import { getWorkspaceKey } from "../services/llm.js";
import { recordUsage } from "../services/analytics.js";
import { loadDedupSet, partitionNew } from "../services/dedup.js";
import { getAutoThresholds, statusFor } from "../services/memory.js";

function handle(reply: import("fastify").FastifyReply, e: unknown) {
  if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
  throw e;
}

export async function sessionRoutes(app: FastifyInstance) {
  // Record a Claude Code session, then extract proposed memories from it.
  app.post("/repos/:repoId/sessions", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    let repo;
    try {
      repo = await assertRepoAccess(user.id, repoId);
    } catch (e) {
      return handle(reply, e);
    }
    const body = recordSessionSchema.parse(req.body);

    const events = [
      ...(body.commandsRun?.map((c) => ({ type: "command", payload: { command: c } })) ?? []),
      ...(body.filesChanged?.map((f) => ({ type: "file_changed", payload: { path: f } })) ?? []),
      ...(body.errors?.map((e) => ({ type: "error", payload: { message: e } })) ?? []),
      ...(body.events ?? []),
    ];

    const session = await prisma.agentSession.create({
      data: {
        repoId,
        agent: body.agent,
        task: body.task,
        summary: body.summary,
        status: "completed",
        events: {
        create: events.map((e) => ({
          type: e.type,
          payload: e.payload as Prisma.InputJsonValue,
        })),
      },
      },
    });

    // Extract proposed memories (workspace LLM key if set, heuristic otherwise),
    // then drop ones that duplicate existing proposed/approved memories.
    const apiKey = await getWorkspaceKey(repo.workspaceId);
    const extracted = await extractMemories(body, apiKey);
    const { fresh } = partitionNew(await loadDedupSet(repoId), extracted);
    const thresholds = await getAutoThresholds(repo.workspaceId);
    const proposed = await Promise.all(
      fresh.map((m) =>
        prisma.memory.create({
          data: {
            repoId,
            type: m.type,
            title: m.title,
            content: m.content,
            scope: "repo",
            confidence: m.confidence,
            status: statusFor(thresholds, m.confidence),
            source: "claude_code_session",
            evidence: m.evidence
              ? { create: [{ kind: "session", content: m.evidence }] }
              : undefined,
          },
        }),
      ),
    );

    await recordUsage("session.recorded", {
      workspaceId: repo.workspaceId,
      repoId,
      metadata: { proposed: proposed.length },
    });

    return reply.code(201).send({
      session: { id: session.id, task: session.task, createdAt: session.createdAt },
      proposedCount: proposed.length,
      proposed: proposed.map((p) => ({ id: p.id, type: p.type, title: p.title })),
    });
  });

  app.get("/repos/:repoId/sessions", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      return handle(reply, e);
    }
    return prisma.agentSession.findMany({
      where: { repoId },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { _count: { select: { events: true } } },
    });
  });

  app.get("/sessions/:sessionId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { sessionId } = req.params as { sessionId: string };
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      include: { events: true },
    });
    if (!session) return reply.code(404).send({ error: "Session not found" });
    try {
      await assertRepoAccess(user.id, session.repoId);
    } catch (e) {
      return handle(reply, e);
    }
    return session;
  });
}
