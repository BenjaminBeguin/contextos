import { prisma } from "../db.js";
import { HttpError } from "../auth.js";

/**
 * Organization helpers. The org owns the plan/billing/entitlements; projects
 * (workspaces) inherit them. These resolve a workspace → its org / plan and
 * enforce org-level roles.
 */

export type OrgRole = "owner" | "admin" | "member";
const ORG_RANK: Record<OrgRole, number> = { owner: 2, admin: 1, member: 0 };

export function orgRoleAtLeast(role: string, min: OrgRole): boolean {
  return (ORG_RANK[role as OrgRole] ?? -1) >= ORG_RANK[min];
}

/** The org id that owns a workspace. */
export async function orgIdForWorkspace(workspaceId: string): Promise<string | null> {
  const w = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organizationId: true },
  });
  return w?.organizationId ?? null;
}

/** The plan of the org that owns a workspace (defaults to "free"). */
export async function planForWorkspace(workspaceId: string): Promise<string> {
  const w = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { organization: { select: { plan: true } } },
  });
  return w?.organization.plan ?? "free";
}

/** The caller's role in an org, or null if not a member. */
export async function orgRole(userId: string, organizationId: string): Promise<OrgRole | null> {
  const m = await prisma.orgMembership.findUnique({
    where: { userId_organizationId: { userId, organizationId } },
  });
  return (m?.role as OrgRole | undefined) ?? null;
}

/** Org owner or admin — can manage billing and every project in the org. */
export async function isOrgManager(userId: string, organizationId: string): Promise<boolean> {
  const role = await orgRole(userId, organizationId);
  return role === "owner" || role === "admin";
}

/** Assert org membership at >= min role; returns the role. */
export async function requireOrgRole(
  userId: string,
  organizationId: string,
  min: OrgRole,
): Promise<OrgRole> {
  const role = await orgRole(userId, organizationId);
  if (!role) throw new HttpError(403, "No access to this organization");
  if (!orgRoleAtLeast(role, min)) throw new HttpError(403, `Requires org ${min} or higher`);
  return role;
}
