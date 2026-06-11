import type { FastifyInstance } from "fastify";
import { mcpSearchMemorySchema, mcpRepoContextSchema } from "@contextos/shared";
import { prisma } from "../db.js";
import { resolveUser, assertRepoAccess, HttpError } from "../auth.js";
import { searchMemories } from "../services/memory.js";
import { recordUsage } from "../services/analytics.js";

function handle(reply: import("fastify").FastifyReply, e: unknown) {
  if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
  throw e;
}

export async function mcpRoutes(app: FastifyInstance) {
  // Return only APPROVED memories for the repo, scoped to the caller's org.
  app.post("/mcp/search_memory", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = mcpSearchMemorySchema.parse(req.body);
    let repo;
    try {
      repo = await assertRepoAccess(user.id, body.repoId);
    } catch (e) {
      return handle(reply, e);
    }
    const memories = await searchMemories({
      repoId: body.repoId,
      query: body.query,
      limit: body.limit,
      approvedOnly: true,
    });
    await recordUsage("mcp.search_memory", {
      workspaceId: repo.workspaceId,
      repoId: repo.id,
      metadata: { query: body.query, results: memories.length },
    });
    return {
      memories: memories.map((m) => ({
        type: m.type,
        title: m.title,
        content: m.content,
        confidence: m.confidence,
      })),
    };
  });

  app.post("/mcp/get_repo_context", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = mcpRepoContextSchema.parse(req.body);
    let repo;
    try {
      repo = await assertRepoAccess(user.id, body.repoId);
    } catch (e) {
      return handle(reply, e);
    }
    const warnings = await prisma.memory.findMany({
      where: { repoId: body.repoId, status: "approved", type: { in: ["risk", "failure"] } },
      orderBy: { confidence: "desc" },
      take: 5,
    });
    const commands = await prisma.memory.findMany({
      where: { repoId: body.repoId, status: "approved", type: "command" },
      orderBy: { confidence: "desc" },
      take: 5,
    });
    await recordUsage("mcp.get_repo_context", {
      workspaceId: repo.workspaceId,
      repoId: repo.id,
    });
    return {
      repoContext: {
        stack: repo.stack,
        packageManager: repo.packageManager,
        notes: repo.notes,
      },
      warnings: warnings.map((w) => w.content),
      recommendedCommands: commands.map((c) => c.content),
    };
  });
}
