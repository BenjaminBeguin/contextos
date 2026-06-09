import { writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";

const MCP_JSON = {
  mcpServers: {
    contextos: {
      type: "stdio",
      command: "contextos",
      args: ["mcp"],
    },
  },
};

const CLAUDE_MD = `# ContextOS Project Memory

Before making changes, use the ContextOS MCP tools to retrieve relevant repo memory.

Recommended tools:
- get_repo_context
- search_memory

Important:
- Respect approved project memories.
- Treat proposed memories as suggestions only.
- Ask before modifying files flagged as high risk.
`;

const SESSION_END_HOOK = `#!/usr/bin/env bash
# ContextOS session-end hook (stub).
# A future ContextOS release will summarize this Claude Code session and
# propose new memories. For now this is a no-op placeholder.
exit 0
`;

const BEFORE_EDIT_HOOK = `#!/usr/bin/env bash
# ContextOS before-edit hook (stub).
# A future ContextOS release will surface relevant warnings before edits.
exit 0
`;

export function writeClaudeAssets(cwd = process.cwd()): void {
  writeFileSync(join(cwd, ".mcp.json"), JSON.stringify(MCP_JSON, null, 2));

  if (!existsSync(join(cwd, "CLAUDE.md"))) {
    writeFileSync(join(cwd, "CLAUDE.md"), CLAUDE_MD);
  }

  const hooksDir = join(cwd, ".claude", "hooks");
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
  const sessionEnd = join(hooksDir, "contextos-session-end.sh");
  const beforeEdit = join(hooksDir, "contextos-before-edit.sh");
  writeFileSync(sessionEnd, SESSION_END_HOOK);
  writeFileSync(beforeEdit, BEFORE_EDIT_HOOK);
  chmodSync(sessionEnd, 0o755);
  chmodSync(beforeEdit, 0o755);
}

export async function claudeInstallCommand() {
  writeClaudeAssets();
  console.log("Installed Claude Code integration:");
  console.log("  .mcp.json");
  console.log("  CLAUDE.md");
  console.log("  .claude/hooks/contextos-session-end.sh");
  console.log("  .claude/hooks/contextos-before-edit.sh");
}
