import { readFileSync, existsSync, mkdtempSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createHash } from "node:crypto";
import { loadCredentials, loadProjectConfig, type ProjectConfig } from "../config.js";
import { apiFetch, type ApiClientOptions } from "../api.js";

/**
 * Claude Code hook runner. Invoked as `cortex hook <event>` from .claude/settings.json.
 * Reads the hook payload as JSON on stdin. MUST be resilient: any failure exits 0 so a
 * misconfigured or offline Cortex never blocks the user's Claude Code session.
 */

interface HookInput {
  session_id?: string;
  transcript_path?: string;
  cwd?: string;
  hook_event_name?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
}

async function readStdin(): Promise<string> {
  if (process.stdin.isTTY) return "";
  const chunks: Buffer[] = [];
  try {
    for await (const c of process.stdin) chunks.push(c as Buffer);
  } catch {
    return "";
  }
  return Buffer.concat(chunks).toString("utf8");
}

function clientFromEnv(cwd?: string): { client: ApiClientOptions; config: ProjectConfig } | null {
  const creds = loadCredentials();
  const config = loadProjectConfig(cwd ?? process.cwd());
  if (!creds || !config) return null;
  return {
    client: { baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl, token: creds.token },
    config,
  };
}

const EDIT_TOOLS = new Set(["Edit", "Write", "MultiEdit", "NotebookEdit"]);

function uniq(arr: string[]): string[] {
  return [...new Set(arr.filter(Boolean))];
}

/** SessionStart: prime the agent with repo context (stack, risks, key commands). */
async function sessionStart(
  input: HookInput,
  env: { client: ApiClientOptions; config: ProjectConfig },
) {
  const ctx = await apiFetch<{
    repoContext: { stack: string[]; packageManager: string | null; notes: string | null };
    warnings: string[];
    recommendedCommands: string[];
  }>(env.client, "/mcp/get_repo_context", {
    method: "POST",
    body: JSON.stringify({ repoId: env.config.repoId, sessionId: input.session_id }),
  });

  const lines: string[] = [];
  if (ctx.repoContext.stack?.length) lines.push(`Stack: ${ctx.repoContext.stack.join(", ")}`);
  if (ctx.repoContext.packageManager) lines.push(`Package manager: ${ctx.repoContext.packageManager}`);
  if (ctx.repoContext.notes) lines.push(`Notes: ${ctx.repoContext.notes}`);
  if (ctx.recommendedCommands?.length)
    lines.push(`Key commands:\n- ${ctx.recommendedCommands.join("\n- ")}`);
  if (ctx.warnings?.length) lines.push(`Known risks:\n- ${ctx.warnings.join("\n- ")}`);

  if (lines.length === 0) return;
  const text = `Cortex operational memory for this repo:\n${lines.join("\n")}`;
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: text },
    }),
  );
}

/**
 * PreToolUse on edits: surface known risks for the target file. To avoid a block loop we
 * warn once per (session, file) via a tmp marker, then allow on the retry.
 */
async function preEdit(input: HookInput, env: { client: ApiClientOptions; config: ProjectConfig }) {
  const ti = input.tool_input ?? {};
  const file = (ti.file_path ?? ti.notebook_path ?? ti.path) as string | undefined;
  if (!file) return;

  const { warnings } = await apiFetch<{
    warnings: { type: string; title: string; content: string }[];
  }>(env.client, "/mcp/get_relevant_warnings", {
    method: "POST",
    body: JSON.stringify({ repoId: env.config.repoId, files: [file], sessionId: input.session_id }),
  });
  if (!warnings.length) return;

  // Warn only once per file per session, otherwise the retry would block forever.
  const key = createHash("sha1")
    .update(`${input.session_id ?? "x"}:${file}`)
    .digest("hex")
    .slice(0, 16);
  const marker = join(tmpdir(), `cortex-warned-${key}`);
  if (existsSync(marker)) return;
  try {
    writeFileSync(marker, "1");
  } catch {
    /* ignore */
  }

  const body = warnings.map((w) => `⚠ [${w.type}] ${w.title}\n  ${w.content}`).join("\n");
  process.stderr.write(`Cortex risk warnings for ${file}:\n${body}\n`);
  process.exit(2); // exit 2 → Claude sees stderr and accounts for it before retrying.
}

/** SessionEnd / Stop: summarize the transcript and propose memories for review. */
async function sessionEnd(input: HookInput, env: { client: ApiClientOptions; config: ProjectConfig }) {
  if (!input.transcript_path || !existsSync(input.transcript_path)) return;
  const raw = readFileSync(input.transcript_path, "utf8");

  const filesChanged: string[] = [];
  const commandsRun: string[] = [];
  const errors: string[] = [];
  let task: string | undefined;

  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    let entry: { message?: { role?: string; content?: unknown } };
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    const msg = entry.message;
    const content = msg?.content;
    if (!Array.isArray(content)) continue;

    for (const item of content as Record<string, unknown>[]) {
      if (item.type === "tool_use") {
        const name = item.name as string;
        const inp = (item.input ?? {}) as Record<string, unknown>;
        if (EDIT_TOOLS.has(name)) {
          const f = (inp.file_path ?? inp.notebook_path) as string | undefined;
          if (f) filesChanged.push(f);
        } else if (name === "Bash" && typeof inp.command === "string") {
          commandsRun.push(inp.command);
        }
      } else if (item.type === "tool_result" && item.is_error) {
        const t = typeof item.content === "string" ? item.content : JSON.stringify(item.content);
        if (t) errors.push(t.slice(0, 300));
      } else if (item.type === "text" && msg?.role === "user" && !task) {
        task = (item.text as string)?.slice(0, 280);
      }
    }
  }

  const files = uniq(filesChanged).slice(0, 50);
  const cmds = uniq(commandsRun).slice(0, 50);
  const errs = uniq(errors).slice(0, 20);

  // Nothing meaningful happened — don't create noise.
  if (files.length === 0 && cmds.length === 0 && errs.length === 0) return;

  const summary = `Claude Code session: ${files.length} file(s) edited, ${cmds.length} command(s) run${
    errs.length ? `, ${errs.length} error(s)` : ""
  }.`;

  await apiFetch(env.client, `/repos/${env.config.repoId}/sessions`, {
    method: "POST",
    body: JSON.stringify({
      agent: "claude-code",
      sessionId: input.session_id,
      task,
      summary,
      filesChanged: files,
      commandsRun: cmds,
      errors: errs,
    }),
  });
}

export async function hookCommand(event: string) {
  let input: HookInput = {};
  try {
    const stdin = await readStdin();
    if (stdin.trim()) input = JSON.parse(stdin) as HookInput;
  } catch {
    process.exit(0);
  }

  try {
    const env = clientFromEnv(input.cwd);
    if (!env) process.exit(0); // not set up here — stay invisible

    if (event === "session-start") await sessionStart(input, env);
    else if (event === "pre-edit") await preEdit(input, env);
    else if (event === "session-end") await sessionEnd(input, env);
  } catch {
    // Never break the user's Claude Code session over a Cortex hiccup.
  }
  process.exit(0);
}
