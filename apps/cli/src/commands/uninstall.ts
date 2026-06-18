import { existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { removeMcpServer, removeSettingsHooks, removeClaudeSection } from "./claude-install.js";

/** Remove all Cortex wiring from the current repo. Leaves global credentials intact. */
export async function uninstallCommand(opts: { yes?: boolean } = {}) {
  const cwd = process.cwd();

  if (!opts.yes) {
    console.log("Remove Cortex from this repo?");
    console.log(`  directory: ${cwd}`);
    console.log("  This removes the cortex MCP server, Claude Code hooks, the CLAUDE.md section,");
    console.log("  and .cortex/config.json. Your login (~/.cortex/credentials.json) is kept.");
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ok = (await rl.question("Continue? (y/N) ")).trim().toLowerCase();
    rl.close();
    if (ok !== "y" && ok !== "yes") {
      console.log("Aborted — nothing changed.");
      return;
    }
  }

  const actions: string[] = [];
  const push = (a: string | null) => {
    if (a) actions.push(a);
  };

  push(removeMcpServer(cwd));
  push(removeSettingsHooks(cwd));
  push(removeClaudeSection(cwd));

  // Project config.
  const configFile = join(cwd, ".cortex", "config.json");
  if (existsSync(configFile)) {
    rmSync(configFile, { force: true });
    actions.push("removed .cortex/config.json");
    const dir = join(cwd, ".cortex");
    if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
  }

  // Legacy stub hook scripts from older versions.
  for (const f of ["cortex-session-end.sh", "cortex-before-edit.sh"]) {
    const p = join(cwd, ".claude", "hooks", f);
    if (existsSync(p)) {
      rmSync(p, { force: true });
      actions.push(`removed legacy .claude/hooks/${f}`);
    }
  }

  if (actions.length === 0) {
    console.log("Nothing to remove — Cortex isn't set up in this repo.");
    return;
  }
  console.log("Removed Cortex from this repo:");
  for (const a of actions) console.log("  - " + a);
  console.log("\nRestart Claude Code so it stops loading the cortex MCP server and hooks.");
}
