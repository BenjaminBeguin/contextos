import Anthropic from "@anthropic-ai/sdk";

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export const llmEnabled = Boolean(apiKey);

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic({ apiKey });
  return client;
}

/**
 * Single-shot completion. The system prompt is marked for prompt caching so the
 * (stable) extractor instructions are not re-billed on every session.
 */
export async function complete(system: string, user: string, maxTokens = 1024): Promise<string> {
  const res = await getClient().messages.create({
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
