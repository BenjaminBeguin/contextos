#!/usr/bin/env node
import { Command } from "commander";
import { loginCommand } from "./commands/login.js";
import { initCommand } from "./commands/init.js";
import { claudeInstallCommand } from "./commands/claude-install.js";
import { mcpCommand } from "./commands/mcp.js";
import { scanCommand } from "./commands/scan.js";
import { VERSION } from "./version.js";

const program = new Command();

program
  .name("cortex")
  .description("Operational memory for AI coding agents")
  .version(VERSION);

program
  .command("login")
  .description("Authenticate and store an API token")
  .option("-e, --email <email>", "Email to log in with")
  .option("--api <url>", "API base URL")
  .action((opts) => run(() => loginCommand(opts)));

program
  .command("init")
  .description("Connect this repo to Cortex and generate Claude Code assets")
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
  .description("Run the Cortex MCP stdio server (used by Claude Code)")
  .action(() => run(() => mcpCommand()));

program
  .command("scan")
  .description("Scan the connected repo and propose starter memories")
  .action(() => run(() => scanCommand()));

for (const stub of ["sync"]) {
  program
    .command(stub)
    .description(`(coming soon) ${stub}`)
    .action(() => {
      console.error(`\`cortex ${stub}\` is not implemented in this MVP pass.`);
      process.exit(1);
    });
}

const memory = program.command("memory").description("(coming soon) manage memories from the CLI");
for (const stub of ["list", "propose"]) {
  memory
    .command(stub)
    .description(`(coming soon) memory ${stub}`)
    .action(() => {
      console.error(`\`cortex memory ${stub}\` is not implemented in this MVP pass.`);
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
