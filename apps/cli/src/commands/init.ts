import { createInterface } from "node:readline/promises";
import { loadCredentials, saveProjectConfig } from "../config.js";
import { apiFetch } from "../api.js";
import { writeClaudeAssets } from "./claude-install.js";

interface RepoSummary {
  id: string;
  name: string;
  fullName: string;
  workspace?: { name: string };
}

export async function initCommand(opts: { repo?: string }) {
  const creds = loadCredentials();
  if (!creds) {
    throw new Error("Not logged in. Run `contextos login` first.");
  }

  const repos = await apiFetch<RepoSummary[]>(creds, "/repos");
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

  saveProjectConfig({
    apiBaseUrl: creds.apiBaseUrl,
    repoId,
    repoFullName: repo.fullName,
  });
  console.log(`Connected repo ${repo.fullName}. Wrote .contextos/config.json`);

  writeClaudeAssets();
  console.log("Generated CLAUDE.md, .mcp.json, and Claude Code hooks.");
}
