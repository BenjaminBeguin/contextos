import type { FastifyInstance } from "fastify";
import {
  mcpSearchMemorySchema,
  mcpRepoContextSchema,
  mcpRelevantWarningsSchema,
} from "@cortex/shared";
import { resolveUser, assertRepoAccess, HttpError } from "../auth.js";
import { toolSearchMemory, toolRepoContext, toolRelevantWarnings } from "../services/mcpTools.js";

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
    try {
      const repo = await assertRepoAccess(user.id, body.repoId);
      return await toolSearchMemory(repo, body.query, body.limit);
    } catch (e) {
      return handle(reply, e);
    }
  });

  app.post("/mcp/get_repo_context", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = mcpRepoContextSchema.parse(req.body);
    try {
      const repo = await assertRepoAccess(user.id, body.repoId);
      return await toolRepoContext(repo, body.sessionId);
    } catch (e) {
      return handle(reply, e);
    }
  });

  // Just-in-time warnings for the files the agent is about to edit.
  app.post("/mcp/get_relevant_warnings", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = mcpRelevantWarningsSchema.parse(req.body);
    try {
      const repo = await assertRepoAccess(user.id, body.repoId);
      return await toolRelevantWarnings(repo, body.files, body.sessionId);
    } catch (e) {
      return handle(reply, e);
    }
  });
}
