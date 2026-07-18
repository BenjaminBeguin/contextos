import type { FastifyInstance } from "fastify";
import { prisma } from "../db.js";
import { resolveUser } from "../auth.js";
import { decryptToken } from "../crypto.js";

interface GitHubRepoRaw {
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
  updated_at: string;
}

export async function githubRoutes(app: FastifyInstance) {
  // List the signed-in user's GitHub repositories for the repo picker.
  app.get("/github/repos", async (req, reply) => {
    const authed = await resolveUser(req);
    if (!authed) return reply.code(401).send({ error: "Unauthorized" });

    const user = await prisma.user.findUnique({ where: { id: authed.id } });
    const token = user?.githubAccessToken ? decryptToken(user.githubAccessToken) : null;
    if (!token) {
      // User authenticated before the repo scope existed, or token is missing.
      return reply.code(409).send({ error: "github_not_connected" });
    }

    const res = await fetch(
      "https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator,organization_member",
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: "application/vnd.github+json",
          "user-agent": "memmo",
        },
      },
    );
    if (res.status === 401) {
      return reply.code(409).send({ error: "github_not_connected" });
    }
    if (!res.ok) {
      return reply.code(502).send({ error: "Failed to fetch repositories from GitHub" });
    }
    const repos = (await res.json()) as GitHubRepoRaw[];
    return repos.map((r) => ({
      fullName: r.full_name,
      name: r.name,
      private: r.private,
      defaultBranch: r.default_branch,
      language: r.language,
      updatedAt: r.updated_at,
    }));
  });
}
