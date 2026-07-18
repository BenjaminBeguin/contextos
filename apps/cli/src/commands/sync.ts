import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch, type ApiClientOptions } from "../api.js";

interface Memory {
  type: string;
  title: string;
  content: string;
  paths?: string[];
}

const START = "<!-- memmo:memory:start -->";
const END = "<!-- memmo:memory:end -->";

/** Render approved memories into a markdown block, grouped by type. */
function renderBlock(memories: Memory[]): string {
  const lines = [START, "", "## Memmo memory (auto-synced — do not edit by hand)", ""];
  if (memories.length === 0) {
    lines.push("_No approved memories yet. Approve some in the Memmo inbox._");
  } else {
    const byType = new Map<string, Memory[]>();
    for (const m of memories) {
      const arr = byType.get(m.type) ?? [];
      arr.push(m);
      byType.set(m.type, arr);
    }
    for (const [type, items] of byType) {
      lines.push(`### ${type}`, "");
      for (const m of items) {
        lines.push(`- **${m.title}** — ${m.content}`);
        if (m.paths?.length) lines.push(`  - paths: ${m.paths.join(", ")}`);
      }
      lines.push("");
    }
  }
  lines.push(`_Last synced ${new Date().toISOString().slice(0, 10)}._`, "", END);
  return lines.join("\n");
}

/** Replace the managed block in CLAUDE.md (or append it), preserving the rest. */
function upsertBlock(existing: string, block: string): string {
  const s = existing.indexOf(START);
  const e = existing.indexOf(END);
  if (s !== -1 && e !== -1 && e > s) {
    return existing.slice(0, s) + block + existing.slice(e + END.length);
  }
  return existing.trimEnd() + "\n\n" + block + "\n";
}

/** Write the repo's approved memories into CLAUDE.md so any agent reading it has them. */
export async function syncCommand() {
  const creds = loadCredentials();
  const config = loadProjectConfig();
  if (!creds) throw new Error("Not logged in. Run `memmo login` first.");
  if (!config) throw new Error("Repo not initialized. Run `memmo init` first.");

  const client: ApiClientOptions = {
    baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl,
    token: creds.token,
  };
  const memories = await apiFetch<Memory[]>(
    client,
    `/repos/${config.repoId}/memories?status=approved`,
  );

  const block = renderBlock(memories);
  const path = join(process.cwd(), "CLAUDE.md");
  const existing = existsSync(path) ? readFileSync(path, "utf8") : "";
  writeFileSync(path, upsertBlock(existing, block));

  console.log(`Synced ${memories.length} approved memory(ies) into CLAUDE.md.`);
}
