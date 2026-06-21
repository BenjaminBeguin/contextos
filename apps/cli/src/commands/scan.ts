import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, delimiter } from "node:path";
import { loadCredentials, loadProjectConfig, type Credentials, type ProjectConfig } from "../config.js";
import { apiFetch, type ApiClientOptions } from "../api.js";

interface ScanResult {
  proposedCount: number;
  filesRead?: number;
}

interface RepoDetail {
  memoryCounts?: { status: string; _count: number }[];
}

export interface ScanOptions {
  /** Force the server-side scan (uses the workspace Anthropic key). */
  server?: boolean;
  /** Force the agent scan (local Claude Code; fails if `claude` isn't found). */
  agent?: boolean;
}

/** Locate an executable on PATH (cross-platform). Returns the full path or null. */
function findOnPath(cmd: string): string | null {
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const full = join(dir, cmd + ext);
      if (existsSync(full)) return full;
    }
  }
  return null;
}

const AGENT_PROMPT = `You are onboarding onto THIS repository to build durable operational memory for future AI coding agents — like writing the onboarding doc for a senior engineer.

Explore the codebase thoroughly first. Read the README, package manifests, config files, the data model / schema, entry points, routes/services/handlers, CI workflows, and a representative sample of the most important source files. Use Read, Glob, and Grep freely.

Then call the propose_memories MCP tool (mcp__cortex__propose_memories) to record a THOROUGH set of memories a new engineer/agent must know:
- Overall architecture and how the major modules/areas fit together (one memory per significant area).
- The data model / key entities (from schema/models).
- The API/interface surface and important flows.
- Key commands: build, run, test, lint, migrate, deploy.
- Conventions and project rules (naming, structure, patterns, error handling, auth).
- Important dependencies and external services.
- Testing and deployment practices.
- Risks, gotchas, and "do not touch" areas.

Rules:
- Base every memory ONLY on what you actually read. Do not invent or assume.
- Be SPECIFIC and concrete — reference real modules, files, and names. No generic boilerplate.
- For area- or risk-specific memories, include path globs in "paths" (e.g. "apps/api/src/routes/**").
- Set confidence 0..1 by certainty and reusability.
- Propose as many high-signal memories as the codebase warrants (up to 20). Favor depth.

When you're done, briefly report how many memories you proposed.`;

async function countProposed(client: ApiClientOptions, repoId: string): Promise<number> {
  try {
    const detail = await apiFetch<RepoDetail>(client, `/repos/${repoId}`);
    const row = detail.memoryCounts?.find((c) => c.status === "proposed");
    return row?._count ?? 0;
  } catch {
    return 0;
  }
}

/** Deep scan by running local Claude Code headlessly — no API key, on the user's subscription. */
async function agentScan(
  claudeBin: string,
  client: ApiClientOptions,
  config: ProjectConfig,
  cwd: string,
): Promise<void> {
  const mcpConfig = join(cwd, ".mcp.json");
  if (!existsSync(mcpConfig)) {
    throw new Error("No .mcp.json found — run `cortex init` (or `cortex claude install`) first.");
  }

  const before = await countProposed(client, config.repoId);

  console.log("Deep scan with local Claude Code (no API key, runs on your Claude subscription)…");
  console.log("Claude is reading the codebase and proposing memories. This can take a few minutes.\n");

  const args = [
    "-p",
    AGENT_PROMPT,
    "--mcp-config",
    mcpConfig,
    "--permission-mode",
    "default",
    "--allowedTools",
    "Read",
    "Glob",
    "Grep",
    "LS",
    "mcp__cortex__get_repo_context",
    "mcp__cortex__search_memory",
    "mcp__cortex__propose_memories",
  ];

  // Run on the user's Claude Code subscription, not an API key. A stale/invalid
  // ANTHROPIC_API_KEY in the environment makes Claude Code prefer it and 401 — so
  // strip those vars and let it use the logged-in (`claude login`) credentials.
  const childEnv = { ...process.env };
  delete childEnv.ANTHROPIC_API_KEY;

  const code = await new Promise<number>((resolve, reject) => {
    const child = spawn(claudeBin, args, { cwd, stdio: "inherit", env: childEnv });
    child.on("error", reject);
    child.on("close", (c) => resolve(c ?? 0));
  });

  if (code !== 0) {
    throw new Error(
      `Claude Code exited with code ${code}.\n` +
        "If you saw a 401/auth error, make sure Claude Code is logged in: run `claude` once and sign in (or `claude login`).\n" +
        "Alternatively, use `cortex scan --server` to scan with the workspace API key.",
    );
  }

  const after = await countProposed(client, config.repoId);
  const added = Math.max(0, after - before);
  console.log(
    `\nDeep scan complete. ${added} new memory proposal(s) created. Review them in the Cortex inbox.`,
  );
}

/** Server-side scan — reads files from GitHub and extracts memories with the workspace key. */
async function serverScan(client: ApiClientOptions, config: ProjectConfig): Promise<void> {
  console.log("Scanning the repo from GitHub…");
  const result = await apiFetch<ScanResult>(client, `/repos/${config.repoId}/scan`, {
    method: "POST",
  });
  const from = result.filesRead != null ? ` (read ${result.filesRead} files)` : "";
  console.log(
    `Proposed ${result.proposedCount} memory(ies)${from}. Review them in the Cortex inbox.`,
  );
}

export async function scanCommand(opts: ScanOptions = {}) {
  const creds: Credentials | null = loadCredentials();
  const config = loadProjectConfig();
  if (!creds) throw new Error("Not logged in. Run `cortex login` first.");
  if (!config) throw new Error("Repo not initialized. Run `cortex init` first.");

  const client: ApiClientOptions = {
    baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl,
    token: creds.token,
  };
  const cwd = process.cwd();

  if (opts.server) {
    return serverScan(client, config);
  }

  const claudeBin = findOnPath("claude");
  if (opts.agent) {
    if (!claudeBin) {
      throw new Error(
        "Claude Code (`claude`) was not found on your PATH. Install it from https://claude.com/claude-code, or run `cortex scan --server`.",
      );
    }
    return agentScan(claudeBin, client, config, cwd);
  }

  // Auto: prefer the local agent (deepest, no key), fall back to the server scan.
  if (claudeBin) {
    return agentScan(claudeBin, client, config, cwd);
  }
  console.log("Claude Code not found locally — falling back to the server scan.\n");
  return serverScan(client, config);
}
