import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch } from "../api.js";

const OK = "\x1b[32m✓\x1b[0m";
const NO = "\x1b[31m✗\x1b[0m";
const WARN = "\x1b[33m!\x1b[0m";

function line(mark: string, label: string, detail = "") {
  console.log(`  ${mark} ${label}${detail ? `  \x1b[2m${detail}\x1b[0m` : ""}`);
}

function readJson<T>(path: string): T | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function hasCortexHooks(cwd: string): { present: boolean; events: string[] } {
  const json = readJson<{ hooks?: Record<string, { hooks?: { command?: string }[] }[]> }>(
    join(cwd, ".claude", "settings.json"),
  );
  if (!json?.hooks) return { present: false, events: [] };
  const events = Object.entries(json.hooks)
    .filter(([, list]) =>
      list?.some((e) => e.hooks?.some((h) => h.command?.includes("cortex hook"))),
    )
    .map(([event]) => event);
  return { present: events.length > 0, events };
}

export async function statusCommand() {
  const cwd = process.cwd();
  console.log("Cortex setup status\n");

  // 1. Auth
  const creds = loadCredentials();
  line(creds ? OK : NO, "Logged in", creds ? creds.apiBaseUrl : "run `cortex login`");

  // 2. Repo connection
  const config = loadProjectConfig(cwd);
  line(
    config ? OK : NO,
    "Repo connected",
    config ? `${config.repoFullName ?? config.repoId}` : "run `cortex init`",
  );

  // 3. Claude Code assets
  const mcp = readJson<{ mcpServers?: Record<string, unknown> }>(join(cwd, ".mcp.json"));
  line(mcp?.mcpServers?.cortex ? OK : NO, ".mcp.json (cortex MCP server)");

  const claudeMd = existsSync(join(cwd, "CLAUDE.md"))
    ? readFileSync(join(cwd, "CLAUDE.md"), "utf8")
    : "";
  line(claudeMd.includes("Cortex") ? OK : WARN, "CLAUDE.md guidance");

  const hooks = hasCortexHooks(cwd);
  line(
    hooks.present ? OK : WARN,
    "Claude Code hooks",
    hooks.present ? hooks.events.join(", ") : "run `cortex claude install`",
  );

  // 4. Live API + repo access
  if (creds && config) {
    const client = { baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl, token: creds.token };
    try {
      const repo = await apiFetch<{ fullName?: string; memoryCounts?: { status: string; _count: number }[] }>(
        client,
        `/repos/${config.repoId}`,
      );
      const approved = repo.memoryCounts?.find((c) => c.status === "approved")?._count ?? 0;
      const proposed = repo.memoryCounts?.find((c) => c.status === "proposed")?._count ?? 0;
      line(OK, "API reachable", `${approved} approved · ${proposed} proposed memories`);
    } catch (e) {
      line(NO, "API reachable", e instanceof Error ? e.message : "request failed");
    }
  }

  const ready = creds && config && mcp?.mcpServers?.cortex && hooks.present;
  console.log(
    ready
      ? "\n\x1b[32mCortex is fully set up for this repo.\x1b[0m"
      : "\nSome steps are incomplete. Run `cortex init` to finish setup.",
  );
}
