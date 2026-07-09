import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MCP_SERVER = { type: "stdio", command: "cortex", args: ["mcp"] };

const CLAUDE_MD_SECTION = `# Cortex Project Memory

Before making changes, use the Cortex MCP tools to retrieve relevant repo memory.

Recommended tools:
- get_repo_context — call before starting work in this repo
- search_memory — search approved memories relevant to your task
- get_relevant_warnings — call BEFORE editing files, passing the paths you'll touch, to surface known risks/outages
- propose_memories — record durable knowledge you discover (conventions, architecture, commands, risks); keep each memory ATOMIC (one fact) and CONCISE (1–3 sentences); NEVER include secrets (passwords, keys, tokens) and keep memories environment-agnostic (no ports, hostnames, or local paths); to bootstrap this repo, read its key files and propose memories
- record_session_summary — call at the end of a meaningful task so Cortex can propose new memories

Important:
- Respect approved project memories.
- Treat proposed memories as suggestions only.
- Always check get_relevant_warnings before modifying sensitive files, and heed the warnings.
- When asked to "scan" or "set up Cortex" for this repo, read the key files and call propose_memories.
`;

// Claude Code hooks that automate the capture/inject loop (run `cortex hook <event>`).
type HookEntry = { matcher?: string; hooks: { type: string; command: string }[] };
const HOOK_EVENTS: Record<string, HookEntry> = {
  SessionStart: { hooks: [{ type: "command", command: "cortex hook session-start" }] },
  UserPromptSubmit: { hooks: [{ type: "command", command: "cortex hook user-prompt" }] },
  PreToolUse: {
    matcher: "Edit|Write|MultiEdit|NotebookEdit",
    hooks: [{ type: "command", command: "cortex hook pre-edit" }],
  },
  SessionEnd: { hooks: [{ type: "command", command: "cortex hook session-end" }] },
};

const isCortexHook = (e: HookEntry): boolean =>
  e.hooks?.some((h) => typeof h.command === "string" && h.command.includes("cortex hook"));

/** Add the cortex MCP server to .mcp.json, preserving any existing servers. */
function mergeMcpJson(path: string): string {
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ mcpServers: { cortex: MCP_SERVER } }, null, 2) + "\n");
    return "created .mcp.json";
  }
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as { mcpServers?: Record<string, unknown> };
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

type Settings = { hooks?: Record<string, HookEntry[]> };

/** Register the Cortex hooks in .claude/settings.json, preserving other hooks/settings. */
function mergeSettingsHooks(claudeDir: string): string {
  if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
  const path = join(claudeDir, "settings.json");
  let json: Settings = {};
  if (existsSync(path)) {
    try {
      json = JSON.parse(readFileSync(path, "utf8")) as Settings;
    } catch {
      return "could not parse .claude/settings.json — add the cortex hooks manually";
    }
  }
  json.hooks = json.hooks ?? {};
  let added = 0;
  for (const [event, entry] of Object.entries(HOOK_EVENTS)) {
    const list = (json.hooks[event] = json.hooks[event] ?? []);
    if (list.some(isCortexHook)) continue; // already wired
    list.push(entry);
    added++;
  }
  if (added === 0) return ".claude/settings.json already has the cortex hooks — left as is";
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
  return existsSync(path) ? `registered ${added} Cortex hook(s) in .claude/settings.json` : "wrote .claude/settings.json";
}

/** Generate/merge Claude Code assets without overwriting existing files. Returns a report. */
export function writeClaudeAssets(cwd = process.cwd()): string[] {
  return [
    mergeMcpJson(join(cwd, ".mcp.json")),
    mergeClaudeMd(join(cwd, "CLAUDE.md")),
    mergeSettingsHooks(join(cwd, ".claude")),
  ];
}

// ---------------------------------------------------------------------------
// Removal helpers (used by `cortex uninstall`).

export function removeMcpServer(cwd = process.cwd()): string | null {
  const path = join(cwd, ".mcp.json");
  if (!existsSync(path)) return null;
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as { mcpServers?: Record<string, unknown> };
    if (!json.mcpServers?.cortex) return null;
    delete json.mcpServers.cortex;
    if (Object.keys(json.mcpServers).length === 0 && Object.keys(json).length === 1) {
      // Only thing left is an empty mcpServers — write the empty shell back.
      writeFileSync(path, JSON.stringify({ mcpServers: {} }, null, 2) + "\n");
    } else {
      writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
    }
    return "removed cortex server from .mcp.json";
  } catch {
    return null;
  }
}

export function removeSettingsHooks(cwd = process.cwd()): string | null {
  const path = join(cwd, ".claude", "settings.json");
  if (!existsSync(path)) return null;
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as Settings;
    if (!json.hooks) return null;
    let removed = 0;
    for (const event of Object.keys(json.hooks)) {
      const before = json.hooks[event]!.length;
      json.hooks[event] = json.hooks[event]!.filter((e) => !isCortexHook(e));
      removed += before - json.hooks[event]!.length;
      if (json.hooks[event]!.length === 0) delete json.hooks[event];
    }
    if (removed === 0) return null;
    if (Object.keys(json.hooks).length === 0) delete json.hooks;
    writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
    return `removed ${removed} Cortex hook(s) from .claude/settings.json`;
  } catch {
    return null;
  }
}

export function removeClaudeSection(cwd = process.cwd()): string | null {
  const path = join(cwd, "CLAUDE.md");
  if (!existsSync(path)) return null;
  const existing = readFileSync(path, "utf8");
  const idx = existing.indexOf("# Cortex Project Memory");
  if (idx === -1) return null;
  const trimmed = existing.slice(0, idx).trimEnd();
  if (trimmed.length === 0) {
    // The file was only the Cortex section.
    writeFileSync(path, "");
    return "cleared Cortex section from CLAUDE.md";
  }
  writeFileSync(path, trimmed + "\n");
  return "removed Cortex section from CLAUDE.md";
}

export async function claudeInstallCommand() {
  const actions = writeClaudeAssets();
  console.log("Claude Code integration:");
  for (const a of actions) console.log("  - " + a);
}
