import { writeFileSync, readFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";

const MCP_SERVER = { type: "stdio", command: "cortex", args: ["mcp"] };

const CLAUDE_MD_SECTION = `# Cortex Project Memory

Before making changes, use the Cortex MCP tools to retrieve relevant repo memory.

Recommended tools:
- get_repo_context — call before starting work in this repo
- search_memory — search approved memories relevant to your task
- get_relevant_warnings — call BEFORE editing files, passing the paths you'll touch, to surface known risks/outages
- propose_memories — record durable knowledge you discover (conventions, architecture, commands, risks); to bootstrap this repo, read its key files and propose memories
- record_session_summary — call at the end of a meaningful task so Cortex can propose new memories

Important:
- Respect approved project memories.
- Treat proposed memories as suggestions only.
- Always check get_relevant_warnings before modifying sensitive files, and heed the warnings.
- When asked to "scan" or "set up Cortex" for this repo, read the key files and call propose_memories.
`;

const SESSION_END_HOOK = `#!/usr/bin/env bash
# Cortex session-end hook (stub).
# A future Cortex release will summarize this Claude Code session and
# propose new memories. For now this is a no-op placeholder.
exit 0
`;

const BEFORE_EDIT_HOOK = `#!/usr/bin/env bash
# Cortex before-edit hook (stub).
# A future Cortex release will surface relevant warnings before edits.
exit 0
`;

/** Add the cortex MCP server to .mcp.json, preserving any existing servers. */
function mergeMcpJson(path: string): string {
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ mcpServers: { cortex: MCP_SERVER } }, null, 2) + "\n");
    return "created .mcp.json";
  }
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as {
      mcpServers?: Record<string, unknown>;
    };
    json.mcpServers = json.mcpServers ?? {};
    if (json.mcpServers.cortex) return ".mcp.json already has the cortex server — left as is";
    json.mcpServers.cortex = MCP_SERVER;
    writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
    return "added cortex server to existing .mcp.json";
  } catch {
    return "could not parse existing .mcp.json — add the cortex server manually";
  }
}

/** Append the Cortex section to CLAUDE.md if it isn't already there. Never overwrites. */
function mergeClaudeMd(path: string): string {
  if (!existsSync(path)) {
    writeFileSync(path, CLAUDE_MD_SECTION);
    return "created CLAUDE.md";
  }
  const existing = readFileSync(path, "utf8");
  if (existing.includes("Cortex Project Memory") || existing.includes("Cortex MCP tools")) {
    return "CLAUDE.md already mentions Cortex — left as is";
  }
  writeFileSync(path, existing.trimEnd() + "\n\n" + CLAUDE_MD_SECTION);
  return "appended Cortex section to existing CLAUDE.md";
}

function writeHookIfMissing(path: string, content: string): boolean {
  if (existsSync(path)) return false;
  writeFileSync(path, content);
  chmodSync(path, 0o755);
  return true;
}

/** Generate/merge Claude Code assets without overwriting existing files. Returns a report. */
export function writeClaudeAssets(cwd = process.cwd()): string[] {
  const actions: string[] = [];
  actions.push(mergeMcpJson(join(cwd, ".mcp.json")));
  actions.push(mergeClaudeMd(join(cwd, "CLAUDE.md")));

  const hooksDir = join(cwd, ".claude", "hooks");
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
  actions.push(
    writeHookIfMissing(join(hooksDir, "cortex-session-end.sh"), SESSION_END_HOOK)
      ? "created .claude/hooks/cortex-session-end.sh"
      : "kept existing cortex-session-end.sh",
  );
  actions.push(
    writeHookIfMissing(join(hooksDir, "cortex-before-edit.sh"), BEFORE_EDIT_HOOK)
      ? "created .claude/hooks/cortex-before-edit.sh"
      : "kept existing cortex-before-edit.sh",
  );
  return actions;
}

export async function claudeInstallCommand() {
  const actions = writeClaudeAssets();
  console.log("Claude Code integration:");
  for (const a of actions) console.log("  - " + a);
}
