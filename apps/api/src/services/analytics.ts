import type { Prisma } from "@prisma/client";
import { prisma } from "../db.js";

export type UsageType =
  | "mcp.search_memory"
  | "mcp.get_repo_context"
  | "mcp.get_relevant_warnings"
  | "memory.approved"
  | "memory.created"
  | "session.recorded"
  | "repo.scanned";

/**
 * Fire-and-forget usage telemetry. Never throws — analytics must not be able to
 * break a product request.
 */
export async function recordUsage(
  type: UsageType,
  opts: { workspaceId?: string; repoId?: string; metadata?: Prisma.InputJsonValue } = {},
): Promise<void> {
  try {
    await prisma.usageEvent.create({
      data: {
        type,
        workspaceId: opts.workspaceId,
        repoId: opts.repoId,
        metadata: opts.metadata,
      },
    });
  } catch {
    // swallow — telemetry is best-effort
  }
}
