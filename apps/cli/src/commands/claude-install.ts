import { writeFileSync, existsSync, mkdirSync, chmodSync } from "node:fs";
import { join } from "node:path";

const MCP_JSON = {
  mcpServers: {
    cortex: {
      type: "stdio",
      command: "cortex",
      args: ["mcp"],
    },
  },
};

const CLAUDE_MD = `# Cortex Project Memory

Before making changes, use the Cortex MCP tools to retrieve relevant repo memory.

Recommended tools:
- get_repo_context — call before starting work in this repo
- search_memory — search approved memories relevant to your task
- get_relevant_warnings — call BEFORE editing files, passing the paths you'll touch, to surface known risks/outages
- record_session_summary — call at the end of a meaningful task so Cortex can propose new memories

Important:
- Respect approved project memories.
- Treat proposed memories as suggestions only.
- Always check get_relevant_warnings before modifying sensitive files, and heed the warnings.
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

export function writeClaudeAssets(cwd = process.cwd()): void {
  writeFileSync(join(cwd, ".mcp.json"), JSON.stringify(MCP_JSON, null, 2));

  if (!existsSync(join(cwd, "CLAUDE.md"))) {
    writeFileSync(join(cwd, "CLAUDE.md"), CLAUDE_MD);
  }

  const hooksDir = join(cwd, ".claude", "hooks");
  if (!existsSync(hooksDir)) mkdirSync(hooksDir, { recursive: true });
  const sessionEnd = join(hooksDir, "cortex-session-end.sh");
  const beforeEdit = join(hooksDir, "cortex-before-edit.sh");
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
  console.log("  .claude/hooks/cortex-session-end.sh");
  console.log("  .claude/hooks/cortex-before-edit.sh");
}
