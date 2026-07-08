import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import type { FastifyRequest, FastifyReply } from "fastify";
import { roleAtLeast, type WorkspaceRole } from "@cortex/shared";
import { prisma } from "./db.js";
import { env } from "./env.js";

export const SESSION_COOKIE = "cortex_session";

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateToken(): string {
  return `ctxos_${randomBytes(24).toString("hex")}`;
}

export function signSession(userId: string): string {
  return jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: "30d" });
}

function verifySession(token: string): string | null {
  try {
    const payload = jwt.verify(token, env.jwtSecret) as { sub?: string };
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

export interface AuthedUser {
  id: string;
  email: string;
  name: string | null;
  avatarUrl?: string | null;
}

/** Resolve the current user from a bearer API token or a session cookie. */
export async function resolveUser(req: FastifyRequest): Promise<AuthedUser | null> {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const raw = authHeader.slice("Bearer ".length).trim();
    const tokenRow = await prisma.apiToken.findUnique({
      where: { hashedToken: hashToken(raw) },
      include: { user: true },
    });
    if (!tokenRow) return null;
    await prisma.apiToken.update({
      where: { id: tokenRow.id },
      data: { lastUsedAt: new Date() },
    });
    return tokenRow.user;
  }

  const cookie = (req.cookies as Record<string, string | undefined>)[SESSION_COOKIE];
  if (cookie) {
    const userId = verifySession(cookie);
    if (!userId) return null;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    return user;
  }

  return null;
}

/** Whether a user is a platform superadmin (SUPERADMIN_EMAILS). */
export function isSuperAdmin(user: { email: string } | null | undefined): boolean {
  return !!user && env.superAdminEmails.includes(user.email.toLowerCase());
}

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
  }
}

/**
 * The user's effective role on a workspace: their explicit project role, or —
 * for org owners/admins — full access to every project in their org (org owner
 * → "owner", org admin → "admin"). Returns null if they can't reach it.
 */
export async function effectiveWorkspaceRole(
  userId: string,
  workspaceId: string,
): Promise<WorkspaceRole | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });
  if (!ws) return null;
  const membership = await prisma.membership.findUnique({
    where: { userId_workspaceId: { userId, workspaceId } },
  });
  if (membership) return membership.role as WorkspaceRole;
  const org = await prisma.orgMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId: ws.organizationId } },
  });
  if (org?.role === "owner") return "owner";
  if (org?.role === "admin") return "admin";
  return null;
}

/** Ensure the user belongs to the workspace that owns the repo. Returns the repo. */
export async function assertRepoAccess(userId: string, repoId: string) {
  const repo = await prisma.repo.findUnique({ where: { id: repoId } });
  if (!repo) throw new HttpError(404, "Repo not found");
  const role = await effectiveWorkspaceRole(userId, repo.workspaceId);
  if (!role) throw new HttpError(403, "No access to this repo");
  return repo;
}

/** Repo access AND at least `min` role in the owning workspace (RBAC). Returns the repo. */
export async function requireRepoRole(userId: string, repoId: string, min: WorkspaceRole) {
  const repo = await prisma.repo.findUnique({ where: { id: repoId } });
  if (!repo) throw new HttpError(404, "Repo not found");
  const role = await effectiveWorkspaceRole(userId, repo.workspaceId);
  if (!role || !roleAtLeast(role, min)) {
    throw new HttpError(403, `Requires ${min} role or higher`);
  }
  return repo;
}

/** Ensure the user can access the workspace. Returns { role } (effective role). */
export async function assertWorkspaceAccess(userId: string, workspaceId: string) {
  const role = await effectiveWorkspaceRole(userId, workspaceId);
  if (!role) throw new HttpError(403, "No access to this workspace");
  return { role };
}

/** Assert workspace access AND that the user's role is at least `min` (RBAC). */
export async function requireRole(userId: string, workspaceId: string, min: WorkspaceRole) {
  const { role } = await assertWorkspaceAccess(userId, workspaceId);
  if (!roleAtLeast(role, min)) {
    throw new HttpError(403, `Requires ${min} role or higher`);
  }
  return { role };
}

/** Global preHandler: when a request authenticates with a project-scoped API
    token, confine it to that project. We inspect the workspace/repo the request
    targets — `:workspaceId`/`:repoId` route params and a `repoId` in the body
    (the MCP routes) — and reject anything outside the token's workspace. Cookie
    sessions and account-wide tokens are unaffected. */
export async function enforceTokenScope(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) return;
  const raw = authHeader.slice("Bearer ".length).trim();
  const token = await prisma.apiToken.findUnique({
    where: { hashedToken: hashToken(raw) },
    select: { workspaceId: true },
  });
  if (!token?.workspaceId) return; // unknown or account-wide token → no confinement here
  const scope = token.workspaceId;

  const params = (req.params ?? {}) as { workspaceId?: string; repoId?: string };
  if (params.workspaceId && params.workspaceId !== scope) {
    reply.code(403).send({ error: "token_scope_workspace" });
    return;
  }
  const repoId = params.repoId ?? (req.body as { repoId?: string } | undefined)?.repoId;
  if (repoId) {
    const repo = await prisma.repo.findUnique({
      where: { id: repoId },
      select: { workspaceId: true },
    });
    if (repo && repo.workspaceId !== scope) {
      reply.code(403).send({ error: "token_scope_repo" });
      return;
    }
  }
}
