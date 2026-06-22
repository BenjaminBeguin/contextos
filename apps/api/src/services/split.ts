import { extractedMemoriesSchema, type ExtractedMemory } from "@cortex/shared";
import { complete } from "./llm.js";

export interface SplitInput {
  type: string;
  title: string;
  content: string;
  paths: string[];
  confidence: number;
}

const SYSTEM = `You split ONE operational memory into several ATOMIC, CONCISE memories.

Rules:
- Each output memory captures exactly ONE fact, rule, command, entity, or decision.
- CONCISE: 1–3 sentences, ideally under ~280 characters each.
- Preserve the original meaning. Do NOT invent anything not in the input.
- Keep the same memory type unless a part clearly belongs to a different one.
- If the memory is already atomic, return it unchanged as a single-element array.

Memory types: project_rule, architecture, command, workflow, decision, failure, risk,
dependency, testing, deployment, business_context.

Output ONLY a JSON array. Each item:
{"type": <type>, "title": <short title>, "content": <the memory>, "confidence": <0..1>, "paths": <optional string[]>}`;

function parseJsonArray(raw: string): unknown {
  const start = raw.indexOf("[");
  const end = raw.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Deterministic fallback: chunk the content into ~2-sentence atomic memories. */
function heuristic(m: SplitInput): ExtractedMemory[] {
  const type = m.type as ExtractedMemory["type"];
  const sentences = m.content
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (sentences.length <= 1) {
    return [{ type, title: m.title, content: m.content, confidence: m.confidence, paths: m.paths }];
  }
  const out: ExtractedMemory[] = [];
  for (let i = 0; i < sentences.length; i += 2) {
    const chunk = sentences.slice(i, i + 2).join(" ");
    out.push({
      type,
      title: chunk.replace(/[.!?]+$/, "").slice(0, 70),
      content: chunk,
      confidence: m.confidence,
      paths: m.paths,
    });
  }
  return out.slice(0, 12);
}

/** Split a memory into atomic, concise memories (LLM if a key is set, else heuristic). */
export async function splitMemory(m: SplitInput, apiKey?: string): Promise<ExtractedMemory[]> {
  if (apiKey) {
    try {
      const raw = await complete(
        apiKey,
        SYSTEM,
        `Type: ${m.type}\nTitle: ${m.title}\nContent: ${m.content}`,
        2048,
      );
      const parsed = extractedMemoriesSchema.safeParse(parseJsonArray(raw));
      if (parsed.success && parsed.data.length > 0) return parsed.data;
    } catch {
      // fall through to heuristic
    }
  }
  return heuristic(m);
}
