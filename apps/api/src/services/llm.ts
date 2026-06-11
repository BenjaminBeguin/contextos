import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db.js";
import { decryptToken } from "../crypto.js";

const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

// The global (your company) key is used ONLY as a fallback when explicitly
// allowed — off in production by default so per-workspace BYOK keys are required.
// Set ALLOW_GLOBAL_LLM=true to opt in (e.g. a managed/paid tier).
const allowGlobal =
  process.env.ALLOW_GLOBAL_LLM === "true" || process.env.NODE_ENV !== "production";
const globalKey = allowGlobal ? process.env.ANTHROPIC_API_KEY : undefined;

/** Pick the effective API key: the workspace's own key, else the allowed global one. */
export function resolveKey(workspaceKey?: string | null): string | undefined {
  return workspaceKey || globalKey || undefined;
}

/** Resolve the effective Anthropic key for a workspace (decrypts its BYOK key). */
export async function getWorkspaceKey(workspaceId: string): Promise<string | undefined> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { anthropicKey: true },
  });
  const wsKey = ws?.anthropicKey ? decryptToken(ws.anthropicKey) : null;
  return resolveKey(wsKey);
}

const clients = new Map<string, Anthropic>();
function clientFor(apiKey: string): Anthropic {
  let c = clients.get(apiKey);
  if (!c) {
    c = new Anthropic({ apiKey });
    clients.set(apiKey, c);
  }
  return c;
}

/**
 * Single-shot completion with a specific API key. The system prompt is marked
 * for prompt caching so the (stable) instructions aren't re-billed every call.
 */
export async function complete(
  apiKey: string,
  system: string,
  user: string,
  maxTokens = 1024,
): Promise<string> {
  const res = await clientFor(apiKey).messages.create({
    model,
    max_tokens: maxTokens,
    temperature: 0,
    system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: user }],
  });
  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");
}
