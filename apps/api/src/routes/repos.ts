import type { FastifyInstance } from "fastify";
import { createRepoSchema, updateRepoSchema } from "@contextos/shared";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, assertRepoAccess, HttpError } from "../auth.js";

export async function repoRoutes(app: FastifyInstance) {
  // List all repos across the user's orgs.
  app.get("/repos", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const memberships = await prisma.membership.findMany({ where: { userId: user.id } });
    const workspaceIds = memberships.map((m) => m.workspaceId);
    const repos = await prisma.repo.findMany({
      where: { workspaceId: { in: workspaceIds } },
      orderBy: { createdAt: "desc" },
      include: {
        workspace: { select: { name: true, slug: true } },
        _count: { select: { memories: true } },
      },
    });
    return repos;
  });

  app.post("/repos", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const body = createRepoSchema.parse(req.body);
    try {
      await assertWorkspaceAccess(user.id, body.workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const repo = await prisma.repo.create({
      data: {
        workspaceId: body.workspaceId,
        provider: body.provider,
        name: body.name,
        fullName: body.fullName,
        defaultBranch: body.defaultBranch,
      },
    });
    return repo;
  });

  app.get("/repos/:repoId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
      include: {
        workspace: { select: { name: true, slug: true } },
        _count: { select: { memories: true, sessions: true } },
      },
    });
    const counts = await prisma.memory.groupBy({
      by: ["status"],
      where: { repoId },
      _count: true,
    });
    const membership = repo
      ? await prisma.membership.findUnique({
          where: { userId_workspaceId: { userId: user.id, workspaceId: repo.workspaceId } },
        })
      : null;
    return { ...repo, memoryCounts: counts, viewerRole: membership?.role ?? "member" };
  });

  // Update repo context (any member).
  app.patch("/repos/:repoId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    const body = updateRepoSchema.parse(req.body);
    return prisma.repo.update({ where: { id: repoId }, data: body });
  });

  // Disconnect (delete) a repo and its memory/sessions/docs (owners only).
  app.delete("/repos/:repoId", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      const repo = await assertRepoAccess(user.id, repoId);
      const membership = await assertWorkspaceAccess(user.id, repo.workspaceId);
      if (membership.role !== "owner") {
        throw new HttpError(403, "Only owners can disconnect a repo");
      }
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    await prisma.repo.delete({ where: { id: repoId } });
    return { ok: true };
  });

  // Stub: scan is a later-phase async job.
  app.post("/repos/:repoId/scan", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    try {
      await assertRepoAccess(user.id, repoId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }
    return reply.code(501).send({ error: "Repo scanning is not implemented in this MVP pass." });
  });
}
