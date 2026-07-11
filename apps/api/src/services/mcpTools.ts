/**
 * The three memory-retrieval tools, shared by the stdio-facing REST routes
 * (routes/mcp.ts) and the remote Streamable-HTTP MCP endpoint (routes/mcpRemote.ts)
 * so their behaviour can't drift. Each takes an already-resolved, already-
 * authorized repo and returns the tool payload.
 */
import { searchMemories } from "./memory.js";
import { memoryStoreForRepo } from "./memoryStore.js";
import { recordUsage } from "./analytics.js";
import { retrievalBlockedForWorkspace } from "./retrievals.js";
import { relevantToFiles } from "./relevance.js";
import { rankMemories, budgetByChars } from "./ranking.js";

export interface ToolRepo {
  id: string;
  workspaceId: string;
  stack: string[];
  packageManager: string | null;
  notes: string | null;
}

export async function toolSearchMemory(repo: ToolRepo, query: string, limit: number, sessionId?: string) {
  if (await retrievalBlockedForWorkspace(repo.workspaceId)) return { memories: [], capped: true };
  const memories = await searchMemories({
    repoId: repo.id,
    query,
    limit,
    approvedOnly: true,
    countUsage: true,
  });
  await recordUsage("mcp.search_memory", {
    workspaceId: repo.workspaceId,
    repoId: repo.id,
    sessionId,
    metadata: { query, results: memories.length },
  });
  return {
    memories: memories.map((m) => ({
      type: m.type,
      title: m.title,
      content: m.content,
      confidence: m.confidence,
    })),
  };
}

export async function toolRepoContext(repo: ToolRepo, sessionId?: string) {
  if (await retrievalBlockedForWorkspace(repo.workspaceId)) {
    return { repoContext: null, warnings: [], recommendedCommands: [], capped: true };
  }
  const { store } = await memoryStoreForRepo(repo.id);
  const approved = await store.listByRepo(repo.id, { status: "approved" });
  const now = new Date();
  const rank = (ms: typeof approved) => budgetByChars(rankMemories("", ms, { limit: 5, now }), 1200);
  const warnings = rank(approved.filter((m) => m.type === "risk" || m.type === "failure"));
  const commands = rank(approved.filter((m) => m.type === "command"));
  const served =
    (repo.stack?.length ?? 0) > 0 ||
    !!repo.packageManager ||
    !!repo.notes ||
    warnings.length > 0 ||
    commands.length > 0;
  await recordUsage("mcp.get_repo_context", {
    workspaceId: repo.workspaceId,
    repoId: repo.id,
    sessionId,
    metadata: { served },
  });
  return {
    repoContext: { stack: repo.stack, packageManager: repo.packageManager, notes: repo.notes },
    warnings: warnings.map((w) => w.content),
    recommendedCommands: commands.map((c) => c.content),
  };
}

export async function toolRelevantWarnings(repo: ToolRepo, files: string[], sessionId?: string) {
  if (await retrievalBlockedForWorkspace(repo.workspaceId)) return { warnings: [], capped: true };
  const { store } = await memoryStoreForRepo(repo.id);
  const risks = (await store.listByRepo(repo.id, { status: "approved" })).filter(
    (m) => m.type === "risk" || m.type === "failure",
  );
  const matched = rankMemories("", relevantToFiles(risks, files), { limit: 8, now: new Date() });
  await recordUsage("mcp.get_relevant_warnings", {
    workspaceId: repo.workspaceId,
    repoId: repo.id,
    sessionId,
    metadata: { files: files.length, matched: matched.length },
  });
  return {
    warnings: matched.map((m) => ({ type: m.type, title: m.title, content: m.content, paths: m.paths })),
  };
}
