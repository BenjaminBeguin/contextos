/**
 * Workspace roles (RBAC). Ordered most→least privileged; each role includes the
 * capabilities of the ones below it. Pure + shared so the API enforces and the
 * app displays the same rules.
 *
 * - owner:  everything, incl. billing, delete workspace, manage roles
 * - admin:  manage repos, reviewer config, members (not billing/delete/roles)
 * - member: use repos, approve/reject memories, give review feedback
 * - viewer: read-only
 */
export const WORKSPACE_ROLES = ["owner", "admin", "member", "viewer"] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

const RANK: Record<WorkspaceRole, number> = { owner: 3, admin: 2, member: 1, viewer: 0 };

export function roleRank(role: string): number {
  return RANK[(role as WorkspaceRole)] ?? 0;
}

/** True when `role` is at least as privileged as `min`. */
export function roleAtLeast(role: string, min: WorkspaceRole): boolean {
  return roleRank(role) >= RANK[min];
}

export const ROLE_LABELS: Record<WorkspaceRole, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
  viewer: "Viewer",
};
