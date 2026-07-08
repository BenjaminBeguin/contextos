import type { FastifyInstance } from "fastify";
import {
  createRepoSchema,
  updateRepoSchema,
  reviewPrSchema,
  reviewDiffSchema,
  setRepoSkillsSchema,
  planLimits,
  withinLimit,
} from "@cortex/shared";
import { prisma } from "../db.js";
import { resolveUser, assertWorkspaceAccess, assertRepoAccess, HttpError } from "../auth.js";
import { decryptToken } from "../crypto.js";
import {
  scanRepo,
  selectKeyFiles,
  selectSourceFiles,
  summarizeStructure,
} from "../services/scan.js";
import { getWorkspaceKey } from "../services/llm.js";
import { recordUsage } from "../services/analytics.js";
import { loadDedupSet, partitionNew } from "../services/dedup.js";
import { getAutoThresholds, statusFor, searchMemories } from "../services/memory.js";
import { memoryStoreForRepo } from "../services/memoryStore.js";
import { reviewPullRequest, formatReviewComment } from "../services/review.js";
import { persistReview } from "../services/feedback.js";

/** Decode a GitHub contents/readme API payload (base64) to UTF-8 text. */
function decodeGhContent(json: unknown): string | null {
  const c = json as { content?: string; encoding?: string };
  if (!c?.content) return null;
  try {
    return Buffer.from(c.content, "base64").toString("utf8");
  } catch {
    return null;
  }
}

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
    // Plan enforcement: cap connected repos by the workspace's plan.
    const ws = await prisma.workspace.findUnique({
      where: { id: body.workspaceId },
      select: { plan: true },
    });
    const limits = planLimits(ws?.plan ?? "free");
    const repoCount = await prisma.repo.count({ where: { workspaceId: body.workspaceId } });
    if (!withinLimit(repoCount, limits.maxRepos)) {
      return reply.code(402).send({
        error: "plan_limit_repos",
        limit: limits.maxRepos,
        message: `Your plan allows ${limits.maxRepos} repos. Upgrade to connect more.`,
      });
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
        reviewerSkills: { select: { skillId: true } },
        _count: { select: { memories: true, sessions: true } },
      },
    });
    // BYODB: memory counts come from the customer's DB.
    const { store } = await memoryStoreForRepo(repoId);
    let counts: { status: string; _count: number }[];
    if (store.external) {
      const rows = await store.listByRepo(repoId);
      const map = new Map<string, number>();
      for (const m of rows) map.set(m.status, (map.get(m.status) ?? 0) + 1);
      counts = [...map].map(([status, n]) => ({ status, _count: n }));
      if (repo) repo._count.memories = rows.length;
    } else {
      const grouped = await prisma.memory.groupBy({ by: ["status"], where: { repoId }, _count: true });
      counts = grouped.map((g) => ({ status: g.status, _count: g._count }));
    }
    const membership = repo
      ? await prisma.membership.findUnique({
          where: { userId_workspaceId: { userId: user.id, workspaceId: repo.workspaceId } },
        })
      : null;
    return {
      ...repo,
      reviewerSkillIds: repo?.reviewerSkills.map((s) => s.skillId) ?? [],
      memoryCounts: counts,
      viewerRole: membership?.role ?? "member",
    };
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
    // Plan enforcement: the PR reviewer is a paid feature.
    if (body.reviewerEnabled === true) {
      const repo = await prisma.repo.findUnique({
        where: { id: repoId },
        select: { workspace: { select: { plan: true } } },
      });
      if (!planLimits(repo?.workspace.plan ?? "free").reviewer) {
        return reply.code(402).send({
          error: "plan_requires_reviewer",
          message: "The PR reviewer is available on the Team plan and up. Upgrade to enable it.",
        });
      }
    }
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

  // Scan the codebase (README, manifest, structure) and propose starter memories.
  app.post("/repos/:repoId/scan", async (req, reply) => {
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
      return reply.code(400).send({ error: "Only GitHub repos (owner/name) can be scanned." });
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

    // Pull the full file tree in one call; fall back to the root listing if needed.
    const branch = repo.defaultBranch || "main";
    const treeRes = await fetch(`${base}/git/trees/${branch}?recursive=1`, { headers });
    if (treeRes.status === 401) return reply.code(409).send({ error: "github_not_connected" });

    let filePaths: string[] = [];
    if (treeRes.ok) {
      const tree = (await treeRes.json()) as { tree?: { path: string; type: string }[] };
      filePaths = (tree.tree ?? []).filter((t) => t.type === "blob").map((t) => t.path);
    } else {
      const rootRes = await fetch(`${base}/contents`, { headers });
      if (rootRes.ok) filePaths = ((await rootRes.json()) as { name: string }[]).map((f) => f.name);
    }

    // Deep scan: read the high-signal config/docs PLUS a sample of source files.
    const keyPaths = selectKeyFiles(filePaths);
    const sourcePaths = selectSourceFiles(filePaths).filter((p) => !keyPaths.includes(p));
    const allPaths = [...keyPaths, ...sourcePaths].slice(0, 40);
    const files = (
      await Promise.all(
        allPaths.map(async (p) => {
          const encoded = encodeURIComponent(p).replace(/%2F/g, "/");
          const r = await fetch(`${base}/contents/${encoded}`, { headers });
          if (!r.ok) return null;
          const content = decodeGhContent(await r.json());
          return content ? { path: p, content } : null;
        }),
      )
    ).filter((f): f is { path: string; content: string } => f !== null);

    // Read commit history (subjects + descriptions) as extra signal for memory extraction.
    const commits: { sha: string; message: string }[] = [];
    for (let page = 1; page <= 5; page++) {
      const cRes = await fetch(
        `${base}/commits?sha=${encodeURIComponent(branch)}&per_page=100&page=${page}`,
        { headers },
      );
      if (!cRes.ok) break;
      const batch = (await cRes.json()) as { sha: string; commit: { message: string } }[];
      for (const c of batch) commits.push({ sha: c.sha, message: c.commit.message });
      if (batch.length < 100) break;
    }

    const apiKey = await getWorkspaceKey(repo.workspaceId);
    const drafts = await scanRepo(
      {
        fullName: repo.fullName,
        stack: repo.stack,
        packageManager: repo.packageManager,
        structure: summarizeStructure(filePaths),
        files,
        commits,
      },
      apiKey,
    );

    // Drop drafts that duplicate existing proposed/approved memories.
    const { fresh: freshDrafts } = partitionNew(await loadDedupSet(repoId), drafts);
    const thresholds = await getAutoThresholds(repo.workspaceId);
    if (freshDrafts.length > 0) {
      const { store } = await memoryStoreForRepo(repoId);
      for (const d of freshDrafts) {
        await store.create({
          repoId,
          workspaceId: repo.workspaceId,
          type: d.type,
          title: d.title,
          content: d.content,
          paths: d.paths ?? [],
          scope: "repo",
          confidence: d.confidence,
          status: statusFor(thresholds, d.confidence),
          source: "repo_scan",
          evidence: d.evidence ? [{ kind: "scan", content: d.evidence }] : undefined,
        });
      }
    }

    await recordUsage("repo.scanned", {
      workspaceId: repo.workspaceId,
      repoId,
      metadata: {
        proposed: freshDrafts.length,
        filesRead: files.length,
        totalFiles: filePaths.length,
        commitsRead: commits.length,
      },
    });

    return { ok: true, proposedCount: freshDrafts.length, filesRead: files.length, commitsRead: commits.length };
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

  // List open pull requests for the reviewer UI.
  app.get("/repos/:repoId/pulls", async (req, reply) => {
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
      return reply.code(400).send({ error: "Only GitHub repos (owner/name) have pull requests." });
    }
    const account = await prisma.user.findUnique({ where: { id: user.id } });
    const token = account?.githubAccessToken ? decryptToken(account.githubAccessToken) : null;
    if (!token) return reply.code(409).send({ error: "github_not_connected" });

    const headers = {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "cortex",
    };
    const r = await fetch(
      `https://api.github.com/repos/${repo.fullName}/pulls?state=open&per_page=30&sort=updated&direction=desc`,
      { headers },
    );
    if (r.status === 401) return reply.code(409).send({ error: "github_not_connected" });
    if (!r.ok) return reply.code(502).send({ error: "Failed to reach GitHub." });
    const pulls = (await r.json()) as {
      number: number;
      title: string;
      html_url: string;
      updated_at: string;
      draft: boolean;
      user: { login: string } | null;
    }[];
    return pulls.map((p) => ({
      number: p.number,
      title: p.title,
      url: p.html_url,
      updatedAt: p.updated_at,
      draft: p.draft,
      author: p.user?.login ?? null,
    }));
  });

  // Set which reviewer skills are attached to this repo (replaces the full set).
  app.put("/repos/:repoId/reviewer-skills", async (req, reply) => {
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
    const { skillIds } = setRepoSkillsSchema.parse(req.body);
    // Only allow skills that belong to this repo's workspace.
    const valid = await prisma.reviewerSkill.findMany({
      where: { id: { in: skillIds }, workspaceId: repo.workspaceId },
      select: { id: true },
    });
    const validIds = valid.map((s) => s.id);
    await prisma.$transaction([
      prisma.repoReviewerSkill.deleteMany({ where: { repoId } }),
      prisma.repoReviewerSkill.createMany({
        data: validIds.map((skillId) => ({ repoId, skillId })),
        skipDuplicates: true,
      }),
    ]);
    return { ok: true, skillIds: validIds };
  });

  // Review a pull request, grounded in this repo's approved memories. Optionally post the
  // review back to the PR as a comment.
  app.post("/repos/:repoId/review", async (req, reply) => {
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
      return reply.code(400).send({ error: "Only GitHub repos (owner/name) can be reviewed." });
    }
    const body = reviewPrSchema.parse(req.body);

    const account = await prisma.user.findUnique({ where: { id: user.id } });
    const token = account?.githubAccessToken ? decryptToken(account.githubAccessToken) : null;
    if (!token) return reply.code(409).send({ error: "github_not_connected" });

    const apiKey = await getWorkspaceKey(repo.workspaceId);
    if (!apiKey) return reply.code(409).send({ error: "llm_not_configured" });

    const headers = {
      authorization: `Bearer ${token}`,
      accept: "application/vnd.github+json",
      "user-agent": "cortex",
    };
    const base = `https://api.github.com/repos/${repo.fullName}`;

    const prRes = await fetch(`${base}/pulls/${body.prNumber}`, { headers });
    if (prRes.status === 401) return reply.code(409).send({ error: "github_not_connected" });
    if (prRes.status === 404) return reply.code(404).send({ error: "Pull request not found." });
    if (!prRes.ok) return reply.code(502).send({ error: "Failed to reach GitHub." });
    const pr = (await prRes.json()) as { title: string; body: string | null };

    const diffRes = await fetch(`${base}/pulls/${body.prNumber}`, {
      headers: { ...headers, accept: "application/vnd.github.v3.diff" },
    });
    const diff = diffRes.ok ? await diffRes.text() : "";

    const memories = await searchMemories({ repoId, query: "", limit: 40, approvedOnly: true });
    const skills = await prisma.reviewerSkill.findMany({
      where: { repos: { some: { repoId } } },
      orderBy: { createdAt: "asc" },
    });
    const review = await reviewPullRequest(
      {
        fullName: repo.fullName,
        prTitle: pr.title,
        prBody: pr.body,
        diff,
        memories: memories.map((m) => ({
          type: m.type,
          title: m.title,
          content: m.content,
          paths: m.paths,
        })),
        instructions: repo.reviewerInstructions,
        skills: skills.map((s) => ({ name: s.name, instructions: s.instructions, paths: s.paths })),
      },
      apiKey,
    );

    let posted = false;
    if (body.post) {
      const cRes = await fetch(`${base}/issues/${body.prNumber}/comments`, {
        method: "POST",
        headers,
        body: JSON.stringify({ body: formatReviewComment(review) }),
      });
      posted = cRes.ok;
    }

    await recordUsage("repo.pr_reviewed", {
      workspaceId: repo.workspaceId,
      repoId,
      metadata: { prNumber: body.prNumber, findings: review.findings.length, posted },
    });

    // Persist the review + findings so humans can give feedback. Non-fatal.
    let persisted: Awaited<ReturnType<typeof persistReview>> | null = null;
    try {
      persisted = await persistReview({
        repoId,
        source: "github",
        prTitle: pr.title,
        prNumber: body.prNumber,
        summary: review.summary,
        findings: review.findings,
      });
    } catch (e) {
      req.log.error(e, "failed to persist review");
    }

    return {
      review,
      posted,
      reviewId: persisted?.id ?? null,
      findings: persisted?.findings.map((f) => ({ id: f.id, key: f.key })) ?? [],
    };
  });

  // CI-native review: the caller supplies the diff (computed in CI), we return the review +
  // a ready-to-post Markdown comment. No GitHub access here — the CI job posts the comment.
  app.post("/repos/:repoId/review-diff", async (req, reply) => {
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
    const body = reviewDiffSchema.parse(req.body);

    // The UI toggle is the CI kill-switch: skip cleanly when the reviewer is disabled.
    if (!repo.reviewerEnabled) return { skipped: true, reason: "reviewer_disabled" };

    const apiKey = await getWorkspaceKey(repo.workspaceId);
    if (!apiKey) return reply.code(409).send({ error: "llm_not_configured" });

    const memories = await searchMemories({ repoId, query: "", limit: 40, approvedOnly: true });
    const skills = await prisma.reviewerSkill.findMany({
      where: { repos: { some: { repoId } } },
      orderBy: { createdAt: "asc" },
    });
    const review = await reviewPullRequest(
      {
        fullName: repo.fullName,
        prTitle: body.prTitle,
        prBody: body.prBody ?? null,
        diff: body.diff,
        memories: memories.map((m) => ({
          type: m.type,
          title: m.title,
          content: m.content,
          paths: m.paths,
        })),
        instructions: repo.reviewerInstructions,
        skills: skills.map((s) => ({ name: s.name, instructions: s.instructions, paths: s.paths })),
      },
      apiKey,
    );

    await recordUsage("repo.pr_reviewed", {
      workspaceId: repo.workspaceId,
      repoId,
      metadata: { findings: review.findings.length, source: "ci" },
    });

    // Persist the review + findings so humans can give feedback. Non-fatal.
    let persisted: Awaited<ReturnType<typeof persistReview>> | null = null;
    try {
      persisted = await persistReview({
        repoId,
        source: "ci",
        prTitle: body.prTitle,
        summary: review.summary,
        findings: review.findings,
      });
    } catch (e) {
      req.log.error(e, "failed to persist review");
    }

    return {
      review,
      comment: formatReviewComment(review),
      skipped: false,
      reviewId: persisted?.id ?? null,
      findings: persisted?.findings.map((f) => ({ id: f.id, key: f.key })) ?? [],
    };
  });
}
