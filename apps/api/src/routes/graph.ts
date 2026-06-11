import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, HttpError } from "../auth.js";

interface GraphNode {
  id: string;
  type: "workspace" | "repo" | "memory" | "session";
  label: string;
  group?: string; // memory type or status, for coloring
  href?: string;
}
interface GraphEdge {
  source: string;
  target: string;
}

export async function graphRoutes(app: FastifyInstance) {
  app.get("/workspaces/:workspaceId/graph", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { workspaceId } = req.params as { workspaceId: string };
    try {
      await assertWorkspaceAccess(user.id, workspaceId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace) return reply.code(404).send({ error: "Workspace not found" });

    const repos = await prisma.repo.findMany({
      where: { workspaceId },
      include: {
        memories: {
          take: 60,
          orderBy: { confidence: "desc" },
          select: { id: true, title: true, type: true, status: true },
        },
        sessions: {
          take: 20,
          orderBy: { createdAt: "desc" },
          select: { id: true, task: true },
        },
      },
    });

    const nodes: GraphNode[] = [
      { id: `ws:${workspace.id}`, type: "workspace", label: workspace.name, href: "/settings" },
    ];
    const edges: GraphEdge[] = [];

    for (const repo of repos) {
      const repoId = `repo:${repo.id}`;
      nodes.push({ id: repoId, type: "repo", label: repo.fullName, href: `/repos/${repo.id}` });
      edges.push({ source: `ws:${workspace.id}`, target: repoId });

      for (const m of repo.memories) {
        const mId = `mem:${m.id}`;
        nodes.push({
          id: mId,
          type: "memory",
          label: m.title,
          group: m.status === "approved" ? m.type : `${m.status}`,
          href: `/repos/${repo.id}/memories`,
        });
        edges.push({ source: repoId, target: mId });
      }

      for (const s of repo.sessions) {
        const sId = `ses:${s.id}`;
        nodes.push({
          id: sId,
          type: "session",
          label: s.task ?? "session",
          href: `/repos/${repo.id}/sessions`,
        });
        edges.push({ source: repoId, target: sId });
      }
    }

    return { nodes, edges };
  });
}
