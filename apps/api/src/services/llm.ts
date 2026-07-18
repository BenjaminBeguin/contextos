import Anthropic from "@anthropic-ai/sdk";
import { prisma } from "../db.js";
import { decryptToken } from "../crypto.js";

export type LlmProvider = "anthropic" | "openai" | "google" | "custom";

/** A resolved, ready-to-use LLM credential for a workspace. */
export interface LlmConfig {
  provider: LlmProvider;
  apiKey: string;
  model?: string | null;
  baseUrl?: string | null;
}

/**
 * Per-provider defaults. Everything except Anthropic is spoken to over the
 * OpenAI-compatible Chat Completions API, so we only need a default model and
 * base URL. Google exposes an OpenAI-compatible endpoint; "custom" brings its
 * own base URL (Azure, OpenRouter, Together, Groq, a local server, …).
 */
const DEFAULTS: Record<LlmProvider, { model: string; baseUrl?: string }> = {
  anthropic: { model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6" },
  openai: {
    model: process.env.OPENAI_MODEL ?? "gpt-4o",
    baseUrl: "https://api.openai.com/v1",
  },
  google: {
    model: process.env.GOOGLE_MODEL ?? "gemini-2.0-flash",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai",
  },
  custom: { model: "" }, // model + baseUrl always come from the workspace
};

export const LLM_PROVIDERS: LlmProvider[] = ["anthropic", "openai", "google", "custom"];

/** The default model shown/used for a provider (before any workspace override). */
export function defaultModelFor(provider: LlmProvider): string {
  return DEFAULTS[provider]?.model ?? "";
}

// The global (your company) key is used ONLY as a fallback when explicitly
// allowed — off in production by default so per-workspace BYOK keys are required.
// Set ALLOW_GLOBAL_LLM=true to opt in (e.g. a managed/paid tier). Global fallback
// is Anthropic-only.
const allowGlobal =
  process.env.ALLOW_GLOBAL_LLM === "true" || process.env.NODE_ENV !== "production";
const globalAnthropicKey = allowGlobal ? process.env.ANTHROPIC_API_KEY : undefined;

/**
 * Resolve the effective LLM config for a workspace: its own BYOK provider+key
 * (decrypted), else the allowed global Anthropic key, else null (not configured).
 */
export async function getWorkspaceLlm(workspaceId: string): Promise<LlmConfig | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { llmProvider: true, llmKey: true, llmModel: true, llmBaseUrl: true },
  });
  const key = ws?.llmKey ? decryptToken(ws.llmKey) : null;
  if (key) {
    const provider = (ws!.llmProvider as LlmProvider) || "anthropic";
    return { provider, apiKey: key, model: ws!.llmModel, baseUrl: ws!.llmBaseUrl };
  }
  if (globalAnthropicKey) return { provider: "anthropic", apiKey: globalAnthropicKey };
  return null;
}

// ---- Anthropic (native SDK, with prompt caching on the system prompt) ----

const anthropicClients = new Map<string, Anthropic>();
function anthropicFor(apiKey: string): Anthropic {
  let c = anthropicClients.get(apiKey);
  if (!c) {
    c = new Anthropic({ apiKey });
    anthropicClients.set(apiKey, c);
  }
  return c;
}

async function completeAnthropic(
  cfg: LlmConfig,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const res = await anthropicFor(cfg.apiKey).messages.create({
    model: cfg.model || DEFAULTS.anthropic.model,
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

// ---- OpenAI-compatible (OpenAI, Google Gemini, custom) over plain fetch ----

async function completeOpenAICompatible(
  cfg: LlmConfig,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const baseUrl = (cfg.baseUrl || DEFAULTS[cfg.provider].baseUrl || "").replace(/\/+$/, "");
  if (!baseUrl) throw new Error(`No base URL configured for provider "${cfg.provider}"`);
  const model = cfg.model || DEFAULTS[cfg.provider].model;
  if (!model) throw new Error(`No model configured for provider "${cfg.provider}"`);

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${cfg.apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature: 0,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LLM request failed (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

/**
 * Single-shot completion. Dispatches to Anthropic's native API or to any
 * OpenAI-compatible Chat Completions endpoint based on the workspace provider.
 * The system prompt is stable, so Anthropic caches it; OpenAI-compatible
 * servers cache automatically.
 */
export async function complete(
  cfg: LlmConfig,
  system: string,
  user: string,
  maxTokens = 1024,
): Promise<string> {
  if (cfg.provider === "anthropic") return completeAnthropic(cfg, system, user, maxTokens);
  return completeOpenAICompatible(cfg, system, user, maxTokens);
}
