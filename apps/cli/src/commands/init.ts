import { createInterface } from "node:readline/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { loadCredentials, saveProjectConfig } from "../config.js";
import { apiFetch } from "../api.js";
import { writeClaudeAssets } from "./claude-install.js";
import { scanCommand } from "./scan.js";

interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  workspace?: { name: string };
}

export async function initCommand(opts: { repo?: string; yes?: boolean; scan?: boolean }) {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error("Not logged in. Run `cortex login` first.");
  }

  const client = { baseUrl: creds.apiBaseUrl, token: creds.token };
  const repos = await apiFetch<RepoSummary[]>(client, "/repos");
  if (repos.length === 0) {
    throw new Error("No repos found for your account. Create one in the web app first.");
  }

  let repoId = opts.repo;
  if (!repoId) {
    if (repos.length === 1) {
      repoId = repos[0]!.id;
    } else {
      console.log("Select a repo to connect:");
      repos.forEach((r, i) => console.log(`  ${i + 1}. ${r.fullName} (${r.id})`));
      const rl = createInterface({ input: process.stdin, output: process.stdout });
      const answer = (await rl.question("Number: ")).trim();
      rl.close();
      const idx = Number(answer) - 1;
      if (Number.isNaN(idx) || !repos[idx]) throw new Error("Invalid selection.");
      repoId = repos[idx]!.id;
    }
  }

  const repo = repos.find((r) => r.id === repoId);
  if (!repo) throw new Error(`Repo ${repoId} not found in your account.`);

  const cwd = process.cwd();

  // Confirm the directory before writing anything — `init` should run at your repo root.
  if (!opts.yes) {
    console.log("\nSet up Cortex in this directory?");
    console.log(`  directory: ${cwd}`);
    console.log(`  repo:      ${repo.fullName}`);
    if (!existsSync(join(cwd, ".git"))) {
      console.log("  note:      no .git here — make sure this is your repo root, not a subfolder.");
    }
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ok = (await rl.question("Continue? (y/N) ")).trim().toLowerCase();
    rl.close();
    if (ok !== "y" && ok !== "yes") {
      console.log("Aborted — no files written.");
      return;
    }
  }

  saveProjectConfig({
    apiBaseUrl: creds.apiBaseUrl,
    repoId,
    repoFullName: repo.fullName,
  });
  console.log(`\nConnected ${repo.fullName} → .cortex/config.json`);

  const actions = writeClaudeAssets(cwd);
  for (const a of actions) console.log("  - " + a);

  // Offer an initial scan to bootstrap memories on first setup.
  let doScan = opts.scan === true;
  if (!doScan && !opts.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    const ans = (
      await rl.question("\nRun an initial scan now to propose starter memories? (Y/n) ")
    )
      .trim()
      .toLowerCase();
    rl.close();
    doScan = ans === "" || ans === "y" || ans === "yes";
  }
  if (doScan) {
    try {
      console.log("");
      await scanCommand();
    } catch (e) {
      console.log(`Scan skipped: ${e instanceof Error ? e.message : String(e)}`);
      console.log("Run it later with `cortex scan`.");
    }
  }
}
