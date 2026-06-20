import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join, delimiter } from "node:path";
import { createInterface } from "node:readline/promises";
import Anthropic from "@anthropic-ai/sdk";
import { loadCredentials, loadProjectConfig } from "../config.js";
import { apiFetch, type ApiClientOptions } from "../api.js";

const SYSTEM = `You are Cortex, answering questions about a software repository using ONLY the
approved operational memories and repo context provided. Be concise and concrete, reference memory
titles when relevant, and if the provided context doesn't answer the question, say so plainly
instead of guessing.`;

interface SearchResult {
  memories: { type: string; title: string; content: string; confidence: number }[];
}
interface RepoContext {
  repoContext: { stack: string[]; packageManager: string | null; notes: string | null };
  warnings: string[];
  recommendedCommands: string[];
}

function findOnPath(cmd: string): string | null {
  const exts = process.platform === "win32" ? ["", ".exe", ".cmd", ".bat"] : [""];
  for (const dir of (process.env.PATH ?? "").split(delimiter)) {
    if (!dir) continue;
    for (const ext of exts) if (existsSync(join(dir, cmd + ext))) return join(dir, cmd + ext);
  }
  return null;
}

/** Pull repo context + the memories most relevant to the question into a prompt block. */
async function buildContext(client: ApiClientOptions, repoId: string, query: string): Promise<string> {
  const [search, ctx] = await Promise.all([
    apiFetch<SearchResult>(client, "/mcp/search_memory", {
      method: "POST",
      body: JSON.stringify({ repoId, query, limit: 12 }),
    }),
    apiFetch<RepoContext>(client, "/mcp/get_repo_context", {
      method: "POST",
      body: JSON.stringify({ repoId }),
    }),
  ]);

  const parts: string[] = [];
  const rc = ctx.repoContext;
  if (rc.stack?.length) parts.push(`Stack: ${rc.stack.join(", ")}`);
  if (rc.packageManager) parts.push(`Package manager: ${rc.packageManager}`);
  if (rc.notes) parts.push(`Notes: ${rc.notes}`);
  if (ctx.recommendedCommands?.length) parts.push(`Key commands:\n- ${ctx.recommendedCommands.join("\n- ")}`);
  if (ctx.warnings?.length) parts.push(`Known risks:\n- ${ctx.warnings.join("\n- ")}`);

  const mems =
    search.memories.length === 0
      ? "(no approved memories matched this question)"
      : search.memories.map((m) => `- [${m.type}] ${m.title}\n  ${m.content}`).join("\n");

  return `Repo context:\n${parts.join("\n") || "(none)"}\n\nRelevant approved memories:\n${mems}`;
}

async function answerWithKey(apiKey: string, context: string, question: string): Promise<void> {
  const client = new Anthropic({ apiKey });
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
  const stream = client.messages.stream({
    model,
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: "user", content: `${context}\n\nQuestion: ${question}` }],
  });
  stream.on("text", (t) => process.stdout.write(t));
  await stream.finalMessage();
  process.stdout.write("\n");
}

async function answerWithClaude(claudeBin: string, context: string, question: string): Promise<void> {
  const prompt = `${SYSTEM}\n\n${context}\n\nQuestion: ${question}`;
  // Run on the user's Claude Code subscription. A stale ANTHROPIC_API_KEY/_AUTH_TOKEN in the
  // environment makes Claude Code prefer it and 401 — strip them so it uses the logged-in creds.
  const env = { ...process.env };
  delete env.ANTHROPIC_API_KEY;
  delete env.ANTHROPIC_AUTH_TOKEN;
  await new Promise<void>((resolve, reject) => {
    const child = spawn(claudeBin, ["-p", prompt], { stdio: ["ignore", "inherit", "inherit"], env });
    child.on("error", reject);
    child.on("close", () => resolve());
  });
}

export async function chatCommand(questionArgs: string[] = []) {
  const creds = loadCredentials();
  const config = loadProjectConfig();
  if (!creds) throw new Error("Not logged in. Run `cortex login` first.");
  if (!config) throw new Error("Repo not initialized. Run `cortex init` first.");
  const client: ApiClientOptions = { baseUrl: config.apiBaseUrl ?? creds.apiBaseUrl, token: creds.token };

  // Use the user's own Anthropic: their API key if present, else their Claude Code subscription.
  const envKey = process.env.ANTHROPIC_API_KEY;
  const claudeBin = envKey ? null : findOnPath("claude");
  if (!envKey && !claudeBin) {
    throw new Error(
      "No Anthropic access found. Set ANTHROPIC_API_KEY (your own key), or install Claude Code (https://claude.com/claude-code) to use your subscription.",
    );
  }

  const answer = async (q: string) => {
    const context = await buildContext(client, config.repoId, q);
    if (envKey) await answerWithKey(envKey, context, q);
    else await answerWithClaude(claudeBin!, context, q);
  };

  const via = envKey ? "your ANTHROPIC_API_KEY" : "your Claude Code subscription";

  // One-shot mode when a question is passed as arguments.
  const oneShot = questionArgs.join(" ").trim();
  if (oneShot) {
    await answer(oneShot);
    return;
  }

  // Interactive REPL.
  console.log(`Cortex chat — grounded in ${config.repoFullName ?? config.repoId} (via ${via}).`);
  console.log("Ask a question, or type 'exit' to quit.\n");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    for (;;) {
      const q = (await rl.question("you › ")).trim();
      if (!q) continue;
      if (q === "exit" || q === "quit") break;
      process.stdout.write("\ncortex › ");
      await answer(q);
      process.stdout.write("\n");
    }
  } finally {
    rl.close();
  }
}
