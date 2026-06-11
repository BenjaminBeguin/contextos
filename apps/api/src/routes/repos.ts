import type { FastifyInstance } from "fastify";
import { createRepoSchema, updateRepoSchema } from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, assertRepoAccess, HttpError } from "../auth.js";
import { decryptToken } from "../crypto.js";

interface GitHubRepoInfo {
  default_branch: string;
  description: string | null;
}

// Filename → package manager, in priority order (lockfiles before manifests).
const PM_FILES: [string, string][] = [
  ["pnpm-lock.yaml", "pnpm"],
  ["yarn.lock", "yarn"],
  ["bun.lockb", "bun"],
  ["package-lock.json", "npm"],
  ["poetry.lock", "poetry"],
  ["Pipfile.lock", "pipenv"],
  ["requirements.txt", "pip"],
  ["Cargo.toml", "cargo"],
  ["go.mod", "go modules"],
  ["Gemfile", "bundler"],
  ["composer.json", "composer"],
  ["pom.xml", "maven"],
  ["build.gradle", "gradle"],
  ["package.json", "npm"],
];

function detectPackageManager(names: Set<string>): string | undefined {
  for (const [file, pm] of PM_FILES) if (names.has(file)) return pm;
  return undefined;
}

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

  // Resync repo context (stack, default branch, description) from GitHub.
  app.post("/repos/:repoId/resync", async (req, reply) => {
    const user = await resolveUser(req);
    if (!user) return reply.code(401).send({ error: "Unauthorized" });
    const { repoId } = req.params as { repoId: string };
    let repo;
    try {
      repo = await assertRepoAccess(user.id, repoId);
    } catch (e) {
      if (e instanceof HttpError) return reply.code(e.statusCode).send({ error: e.message });
      throw e;
    }

    if (repo.provider !== "github" || !repo.fullName.includes("/")) {
      return reply.code(400).send({ error: "Only GitHub repos (owner/name) can be resynced." });
    }

    const account = await prisma.user.findUnique({ where: { id: user.id } });
    const token = account?.githubAccessToken ? decryptToken(account.githubAccessToken) : null;
    if (!token) return reply.code(409).send({ error: "github_not_connected" });

    const headers = {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "cortex",
    };
    const base = `https://api.github.com/repos/${repo.fullName}`;
    const [infoRes, langRes, contentsRes] = await Promise.all([
      fetch(base, { headers }),
      fetch(`${base}/languages`, { headers }),
      fetch(`${base}/contents`, { headers }),
    ]);
    if (infoRes.status === 401) return reply.code(409).send({ error: "github_not_connected" });
    if (infoRes.status === 404) {
      return reply.code(404).send({ error: "Repo not found on GitHub (check access)." });
    }
    if (!infoRes.ok) return reply.code(502).send({ error: "Failed to reach GitHub." });

    const info = (await infoRes.json()) as GitHubRepoInfo;
    const languages = langRes.ok ? ((await langRes.json()) as Record<string, number>) : {};
    const stack = Object.entries(languages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([lang]) => lang);

    let packageManager: string | undefined;
    if (contentsRes.ok) {
      const files = (await contentsRes.json()) as { name: string }[];
      packageManager = detectPackageManager(new Set(files.map((f) => f.name)));
    }

    const updated = await prisma.repo.update({
      where: { id: repoId },
      data: {
        defaultBranch: info.default_branch,
        ...(stack.length > 0 ? { stack } : {}),
        ...(packageManager ? { packageManager } : {}),
        // Only fill notes from the GitHub description if the user hasn't set their own.
        ...(!repo.notes && info.description ? { notes: info.description } : {}),
      },
    });
    return {
      ok: true,
      repo: updated,
      synced: { stack, defaultBranch: info.default_branch, packageManager: packageManager ?? null },
    };
  });
}
