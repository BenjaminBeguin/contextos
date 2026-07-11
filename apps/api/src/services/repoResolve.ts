import { prisma } from "../db.js";
import { effectiveWorkspaceRole } from "../auth.js";

/**
 * Repo resolution for the remote MCP connector. A remote (HTTP) MCP server has
 * no local working directory, so the agent passes its repo's identity — a git
 * remote or `owner/repo` — and we match it to a connected repo the caller can
 * access. Everything is scoped to the caller's real access, so an agent-supplied
 * string can never reach a repo the user isn't a member of.
 */

/**
 * Reduce any repo identifier to a canonical lowercase `owner/repo`:
 *   git@github.com:Owner/Repo.git         → owner/repo
 *   https://github.com/Owner/Repo(.git)   → owner/repo
 *   ssh://git@host/Owner/Repo             → owner/repo
 *   Owner/Repo                            → owner/repo
 * A bare local path yields its last two segments, which simply won't match a
 * connected repo — the agent should pass the remote, not the working dir.
 */
export function normalizeRepoIdentifier(identifier: string): string {
  let s = identifier.trim();
  s = s.replace(/^git@[^:]+:/, ""); // scp-style git remote
  s = s.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/]+\//i, ""); // scheme://host/
  s = s.replace(/\.git$/i, "");
  s = s.replace(/^\/+|\/+$/g, "");
  const parts = s.split("/").filter(Boolean);
  if (parts.length >= 2) s = parts.slice(-2).join("/");
  return s.toLowerCase();
}

/** Workspace ids the user can reach: explicit project memberships + every
    project in orgs where they're owner/admin. `restrictTo`, when set (a
    project-scoped token), further confines the result to that one workspace. */
export async function accessibleWorkspaceIds(
  userId: string,
  restrictTo?: string | null,
): Promise<string[]> {
  const [memberships, orgAdmin] = await Promise.all([
    prisma.membership.findMany({ where: { userId }, select: { workspaceId: true } }),
    prisma.orgMembership.findMany({
      where: { userId, role: { in: ["owner", "admin"] } },
      select: { organizationId: true },
    }),
  ]);
  const orgWs = orgAdmin.length
    ? await prisma.workspace.findMany({
        where: { organizationId: { in: orgAdmin.map((o) => o.organizationId) } },
        select: { id: true },
      })
    : [];
  let ids = [...new Set([...memberships.map((m) => m.workspaceId), ...orgWs.map((w) => w.id)])];
  if (restrictTo) ids = ids.filter((id) => id === restrictTo);
  return ids;
}

export interface RepoRef {
  id: string;
  fullName: string;
  project: string;
}

/** List the repos the caller can reach — the discovery/fallback tool. */
export async function listReposForUser(userId: string, restrictTo?: string | null): Promise<RepoRef[]> {
  const wsIds = await accessibleWorkspaceIds(userId, restrictTo);
  if (wsIds.length === 0) return [];
  const repos = await prisma.repo.findMany({
    where: { workspaceId: { in: wsIds } },
    select: { id: true, fullName: true, workspace: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  return repos.map((r) => ({ id: r.id, fullName: r.fullName, project: r.workspace.name }));
}

export interface ResolveResult {
  repoId: string;
  fullName: string;
}

/**
 * Resolve an agent-supplied identifier to a repo the caller can access.
 * Returns null when nothing matches (the caller should surface list_repos).
 * Authorization is intrinsic: we only ever match within accessible repos.
 */
export async function resolveRepoForUser(
  userId: string,
  identifier: string,
  restrictTo?: string | null,
): Promise<ResolveResult | null> {
  const norm = normalizeRepoIdentifier(identifier);
  if (!norm) return null;
  const wsIds = await accessibleWorkspaceIds(userId, restrictTo);
  if (wsIds.length === 0) return null;
  const repos = await prisma.repo.findMany({
    where: { workspaceId: { in: wsIds } },
    select: { id: true, fullName: true },
  });
  const match = repos.find((r) => normalizeRepoIdentifier(r.fullName) === norm);
  // Extra safety: a bad identifier can't resolve — but if the caller passed a
  // raw repoId that they can access, honour it too.
  if (match) return { repoId: match.id, fullName: match.fullName };
  const byId = repos.find((r) => r.id === identifier.trim());
  return byId ? { repoId: byId.id, fullName: byId.fullName } : null;
}
