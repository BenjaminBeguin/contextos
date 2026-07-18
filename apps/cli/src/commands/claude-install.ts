import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const MCP_SERVER = { type: "stdio", command: "memmo", args: ["mcp"] };

const CLAUDE_MD_SECTION = `# Memmo Project Memory

Before making changes, use the Memmo MCP tools to retrieve relevant repo memory.

Recommended tools:
- get_repo_context — call before starting work in this repo
- search_memory — search approved memories relevant to your task
- get_relevant_warnings — call BEFORE editing files, passing the paths you'll touch, to surface known risks/outages
- propose_memories — record durable knowledge you discover (conventions, architecture, commands, risks); keep each memory ATOMIC (one fact) and CONCISE (1–3 sentences); NEVER include secrets (passwords, keys, tokens) and keep memories environment-agnostic (no ports, hostnames, or local paths); to bootstrap this repo, read its key files and propose memories
- record_session_summary — call at the end of a meaningful task so Memmo can propose new memories

Important:
- Respect approved project memories.
- Treat proposed memories as suggestions only.
- Always check get_relevant_warnings before modifying sensitive files, and heed the warnings.
- When asked to "scan" or "set up Memmo" for this repo, read the key files and call propose_memories.
`;

// Claude Code hooks that automate the capture/inject loop (run `memmo hook <event>`).
type HookEntry = { matcher?: string; hooks: { type: string; command: string }[] };
const HOOK_EVENTS: Record<string, HookEntry> = {
  SessionStart: { hooks: [{ type: "command", command: "memmo hook session-start" }] },
  UserPromptSubmit: { hooks: [{ type: "command", command: "memmo hook user-prompt" }] },
  PreToolUse: {
    matcher: "Edit|Write|MultiEdit|NotebookEdit",
    hooks: [{ type: "command", command: "memmo hook pre-edit" }],
  },
  SessionEnd: { hooks: [{ type: "command", command: "memmo hook session-end" }] },
};

const isMemmoHook = (e: HookEntry): boolean =>
  e.hooks?.some((h) => typeof h.command === "string" && h.command.includes("memmo hook"));

/** Add the memmo MCP server to .mcp.json, preserving any existing servers. */
function mergeMcpJson(path: string): string {
  if (!existsSync(path)) {
    writeFileSync(path, JSON.stringify({ mcpServers: { memmo: MCP_SERVER } }, null, 2) + "\n");
    return "created .mcp.json";
  }
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as { mcpServers?: Record<string, unknown> };
    json.mcpServers = json.mcpServers ?? {};
    if (json.mcpServers.memmo) return ".mcp.json already has the memmo server — left as is";
    json.mcpServers.memmo = MCP_SERVER;
    writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
    return "added memmo server to existing .mcp.json";
  } catch {
    return "could not parse existing .mcp.json — add the memmo server manually";
  }
}

/** Append the Memmo section to CLAUDE.md if it isn't already there. Never overwrites. */
function mergeClaudeMd(path: string): string {
  if (!existsSync(path)) {
    writeFileSync(path, CLAUDE_MD_SECTION);
    return "created CLAUDE.md";
  }
  const existing = readFileSync(path, "utf8");
  if (existing.includes("Memmo Project Memory") || existing.includes("Memmo MCP tools")) {
    return "CLAUDE.md already mentions Memmo — left as is";
  }
  writeFileSync(path, existing.trimEnd() + "\n\n" + CLAUDE_MD_SECTION);
  return "appended Memmo section to existing CLAUDE.md";
}

type Settings = { hooks?: Record<string, HookEntry[]> };

/** Register the Memmo hooks in .claude/settings.json, preserving other hooks/settings. */
function mergeSettingsHooks(claudeDir: string): string {
  if (!existsSync(claudeDir)) mkdirSync(claudeDir, { recursive: true });
  const path = join(claudeDir, "settings.json");
  let json: Settings = {};
  if (existsSync(path)) {
    try {
      json = JSON.parse(readFileSync(path, "utf8")) as Settings;
    } catch {
      return "could not parse .claude/settings.json — add the memmo hooks manually";
    }
  }
  json.hooks = json.hooks ?? {};
  let added = 0;
  for (const [event, entry] of Object.entries(HOOK_EVENTS)) {
    const list = (json.hooks[event] = json.hooks[event] ?? []);
    if (list.some(isMemmoHook)) continue; // already wired
    list.push(entry);
    added++;
  }
  if (added === 0) return ".claude/settings.json already has the memmo hooks — left as is";
  writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
  return existsSync(path) ? `registered ${added} Memmo hook(s) in .claude/settings.json` : "wrote .claude/settings.json";
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
// Removal helpers (used by `memmo uninstall`).

export function removeMcpServer(cwd = process.cwd()): string | null {
  const path = join(cwd, ".mcp.json");
  if (!existsSync(path)) return null;
  try {
    const json = JSON.parse(readFileSync(path, "utf8")) as { mcpServers?: Record<string, unknown> };
    if (!json.mcpServers?.memmo) return null;
    delete json.mcpServers.memmo;
    if (Object.keys(json.mcpServers).length === 0 && Object.keys(json).length === 1) {
      // Only thing left is an empty mcpServers — write the empty shell back.
      writeFileSync(path, JSON.stringify({ mcpServers: {} }, null, 2) + "\n");
    } else {
      writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
    }
    return "removed memmo server from .mcp.json";
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
      json.hooks[event] = json.hooks[event]!.filter((e) => !isMemmoHook(e));
      removed += before - json.hooks[event]!.length;
      if (json.hooks[event]!.length === 0) delete json.hooks[event];
    }
    if (removed === 0) return null;
    if (Object.keys(json.hooks).length === 0) delete json.hooks;
    writeFileSync(path, JSON.stringify(json, null, 2) + "\n");
    return `removed ${removed} Memmo hook(s) from .claude/settings.json`;
  } catch {
    return null;
  }
}

export function removeClaudeSection(cwd = process.cwd()): string | null {
  const path = join(cwd, "CLAUDE.md");
  if (!existsSync(path)) return null;
  const existing = readFileSync(path, "utf8");
  const idx = existing.indexOf("# Memmo Project Memory");
  if (idx === -1) return null;
  const trimmed = existing.slice(0, idx).trimEnd();
  if (trimmed.length === 0) {
    // The file was only the Memmo section.
    writeFileSync(path, "");
    return "cleared Memmo section from CLAUDE.md";
  }
  writeFileSync(path, trimmed + "\n");
  return "removed Memmo section from CLAUDE.md";
}

export async function claudeInstallCommand() {
  const actions = writeClaudeAssets();
  console.log("Claude Code integration:");
  for (const a of actions) console.log("  - " + a);
}
