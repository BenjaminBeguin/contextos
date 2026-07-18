import { existsSync, rmSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { createInterface } from "node:readline/promises";
import { removeMcpServer, removeSettingsHooks, removeClaudeSection } from "./claude-install.js";

/** Remove all Memmo wiring from the current repo. Leaves global credentials intact. */
export async function uninstallCommand(opts: { yes?: boolean } = {}) {
  const cwd = process.cwd();

  if (!opts.yes) {
    console.log("Remove Memmo from this repo?");
    console.log(`  directory: ${cwd}`);
    console.log("  This removes the memmo MCP server, Claude Code hooks, the CLAUDE.md section,");
    console.log("  and .memmo/config.json. Your login (~/.memmo/credentials.json) is kept.");
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
  const configFile = join(cwd, ".memmo", "config.json");
  if (existsSync(configFile)) {
    rmSync(configFile, { force: true });
    actions.push("removed .memmo/config.json");
    const dir = join(cwd, ".memmo");
    if (existsSync(dir) && readdirSync(dir).length === 0) rmSync(dir, { recursive: true, force: true });
  }

  // Legacy stub hook scripts from older versions.
  for (const f of ["memmo-session-end.sh", "memmo-before-edit.sh"]) {
    const p = join(cwd, ".claude", "hooks", f);
    if (existsSync(p)) {
      rmSync(p, { force: true });
      actions.push(`removed legacy .claude/hooks/${f}`);
    }
  }

  if (actions.length === 0) {
    console.log("Nothing to remove — Memmo isn't set up in this repo.");
    return;
  }
  console.log("Removed Memmo from this repo:");
  for (const a of actions) console.log("  - " + a);
  console.log("\nRestart Claude Code so it stops loading the memmo MCP server and hooks.");
}
