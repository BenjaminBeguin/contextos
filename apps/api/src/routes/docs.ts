import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { resolveUser, assertRepoAccess, HttpError } from "../auth.js";
import { generateDocs } from "../services/docs.js";

function handle(reply: import("fastify").FastifyReply, e: unknown) {
  if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
  throw e;
}

export async function docRoutes(app: FastifyInstance) {
  app.get("/repos/:repoId/docs", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      return handle(reply, e);
    }
    return prisma.generatedDoc.findMany({
      where: { repoId },
      orderBy: { type: "asc" },
    });
  });

  app.post("/repos/:repoId/docs/generate", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    let repo;
    try {
      repo = await assertRepoAccess(user.id, repoId);
    } catch (e) {
      return handle(reply, e);
    }
    const docs = await generateDocs({
      id: repo.id,
      fullName: repo.fullName,
      stack: repo.stack,
      packageManager: repo.packageManager,
      notes: repo.notes,
    });
    return reply.code(201).send({ generated: docs });
  });

  app.get("/docs/:docId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { docId } = req.params as { docId: string };
    const doc = await prisma.generatedDoc.findUnique({ where: { id: docId } });
    if (!doc) return reply.code(404).send({ error: "Doc not found" });
    try {
      await assertRepoAccess(user.id, doc.repoId);
    } catch (e) {
      return handle(reply, e);
    }
    return doc;
  });
}
