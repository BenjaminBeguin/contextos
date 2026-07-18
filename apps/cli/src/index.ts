#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { initCommand } from "./commands/init.js";
import { claudeInstallCommand } from "./commands/claude-install.js";
import { mcpCommand } from "./commands/mcp.js";
import { scanCommand } from "./commands/scan.js";
import { hookCommand } from "./commands/hook.js";
import { statusCommand } from "./commands/status.js";
import { uninstallCommand } from "./commands/uninstall.js";
import { chatCommand } from "./commands/chat.js";
import { decisionCommand } from "./commands/decision.js";
import { syncCommand } from "./commands/sync.js";
import { reviewCommand } from "./commands/review.js";
import { reviewSyncCommand } from "./commands/review-sync.js";
import { ciCommand } from "./commands/ci.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("memmo")
  .description("Long-term memory for AI coding agents")
  .version(VERSION);

program
  .command("login")
  .description("Authenticate and store an API token")
  .option("-e, --email <email>", "Email to log in with")
  .option("--api <url>", "API base URL")
  .action((opts) => run(() => loginCommand(opts)));

program
  .command("init")
  .description("Connect this repo to Memmo and generate Claude Code assets")
  .option("-r, --repo <repoId>", "Repo ID to connect")
  .option("-y, --yes", "Skip the directory confirmation prompt")
  .option("--scan", "Run an initial codebase scan after connecting")
  .action((opts) => run(() => initCommand(opts)));

program
  .command("claude")
  .description("Claude Code integration")
  .command("install")
  .description("Generate CLAUDE.md, .mcp.json, and hooks")
  .action(() => run(() => claudeInstallCommand()));

program
  .command("mcp")
  .description("Run the Memmo MCP stdio server (used by Claude Code / Claude Desktop)")
  .option("-r, --repo <repoId>", "Repo to serve (for Claude Desktop; defaults to .memmo/config.json)")
  .option("--api <url>", "API base URL")
  .action((opts) => run(() => mcpCommand(opts)));

program
  .command("scan")
  .description("Scan the connected repo and propose starter memories")
  .option("--agent", "Deep scan with local Claude Code (no API key, uses your subscription)")
  .option("--server", "Scan on the server from GitHub (uses the workspace Anthropic key)")
  .action((opts) => run(() => scanCommand(opts)));

program
  .command("chat [question...]")
  .description("Chat with this repo's memory using your own Anthropic (key or Claude subscription)")
  .action((question: string[]) => run(() => chatCommand(question)));

program
  .command("decision <text...>")
  .description("Record a project decision (what changed) as memory")
  .option("--why <reason>", "Why the decision was made")
  .action((text: string[], opts: { why?: string }) => run(() => decisionCommand(text, opts)));

program
  .command("status")
  .description("Check whether Memmo is set up in this repo")
  .action(() => run(() => statusCommand()));

program
  .command("uninstall")
  .description("Remove Memmo wiring (MCP server, hooks, CLAUDE.md section) from this repo")
  .option("-y, --yes", "Skip the confirmation prompt")
  .action((opts) => run(() => uninstallCommand(opts)));

// Internal: invoked by Claude Code hooks registered in .claude/settings.json.
program
  .command("hook <event>", { hidden: true })
  .description("Run a Memmo Claude Code hook (internal)")
  .action((event: string) => hookCommand(event));

program
  .command("sync")
  .description("Write approved memories into a managed CLAUDE.md block")
  .action(() => run(() => syncCommand()));

program
  .command("review")
  .description("Review the current PR's diff with Memmo (inline comments in CI, or Markdown output)")
  .option("--base <ref>", "Base branch to diff against (default: $GITHUB_BASE_REF or main)")
  .option("--title <title>", "PR title (default: from the GitHub event or last commit)")
  .option("--body <body>", "PR description")
  .option("--post", "Post a PR review with inline comments using GH_TOKEN (for CI)")
  .option("--out <file>", "Write the review Markdown to a file instead of posting")
  .option("--api <url>", "API base URL")
  .action((opts) => run(() => reviewCommand(opts)));

program
  .command("review-sync")
  .description("Sync GitHub 👍/👎 reactions on Memmo review comments back as finding feedback")
  .option("--api <url>", "API base URL")
  .action((opts) => run(() => reviewSyncCommand(opts)));

program
  .command("ci")
  .description("Generate a GitHub Actions workflow that runs the Memmo PR reviewer")
  .option("-f, --force", "Overwrite an existing workflow file")
  .action((opts) => run(() => ciCommand(opts)));

const memory = program.command("memory").description("(coming soon) manage memories from the CLI");
for (const stub of ["list", "propose"]) {
  memory
    .command(stub)
    .description(`(coming soon) memory ${stub}`)
    .action(() => {
      console.error(`\`memmo memory ${stub}\` is not implemented in this MVP pass.`);
      process.exit(1);
    });
}

function run(fn: () => Promise<void>) {
  fn().catch((err: unknown) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}

program.parseAsync();
