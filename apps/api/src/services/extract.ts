import { extractedMemoriesSchema, type ExtractedMemory, type RecordSessionInput } from "@cortex/shared";
import { llmEnabled, complete } from "./llm.js";

const SYSTEM = `You extract durable operational memories from an AI coding agent's work session.

A good memory is reusable knowledge a future agent should know before working in this repo:
project rules, architecture facts, important commands, workflows, decisions, failures,
risks, dependencies, testing practices, deployment steps, or business context.

Rules:
- Only extract high-signal, durable facts. Ignore one-off trivia and noise.
- Each memory must be specific and self-contained.
- Set confidence 0..1 reflecting how certain and reusable the memory is.
- Prefer 0-4 memories. If nothing is worth remembering, return [].

Memory types: project_rule, architecture, command, workflow, decision, failure, risk,
dependency, testing, deployment, business_context.

Output ONLY a JSON array, no prose. Each item:
{"type": <type>, "title": <short title>, "content": <the memory>, "confidence": <0..1>, "evidence": <optional short quote>}`;

function renderSession(input: RecordSessionInput): string {
  const parts: string[] = [];
  if (input.task) parts.push(`Task: ${input.task}`);
  if (input.summary) parts.push(`Summary: ${input.summary}`);
  if (input.commandsRun?.length) parts.push(`Commands run:\n- ${input.commandsRun.join("\n- ")}`);
  if (input.filesChanged?.length) parts.push(`Files changed:\n- ${input.filesChanged.join("\n- ")}`);
  if (input.errors?.length) parts.push(`Errors encountered:\n- ${input.errors.join("\n- ")}`);
  if (input.events?.length) {
    parts.push(
      `Events:\n${input.events.map((e) => `- ${e.type}: ${JSON.stringify(e.payload)}`).join("\n")}`,
    );
  }
  return parts.join("\n\n") || "(empty session)";
}

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

/** Deterministic fallback when no LLM key is configured. */
function heuristic(input: RecordSessionInput): ExtractedMemory[] {
  const out: ExtractedMemory[] = [];
  for (const err of input.errors ?? []) {
    out.push({
      type: "failure",
      title: `Failure: ${err.slice(0, 60)}`,
      content: `A previous session hit this error: ${err}. Check for it before similar changes.`,
      confidence: 0.5,
      evidence: err,
    });
  }
  for (const cmd of input.commandsRun ?? []) {
    if (/test|build|lint|migrate|deploy|make /i.test(cmd)) {
      out.push({
        type: /test/i.test(cmd) ? "testing" : /deploy/i.test(cmd) ? "deployment" : "command",
        title: `Command: ${cmd.slice(0, 60)}`,
        content: `This session used \`${cmd}\`.`,
        confidence: 0.45,
      });
    }
  }
  return out.slice(0, 4);
}

export async function extractMemories(input: RecordSessionInput): Promise<ExtractedMemory[]> {
  if (llmEnabled) {
    try {
      const raw = await complete(SYSTEM, renderSession(input));
      const parsed = extractedMemoriesSchema.safeParse(parseJsonArray(raw));
      if (parsed.success) return parsed.data;
    } catch {
      // fall through to heuristic on any LLM/parse error
    }
  }
  return heuristic(input);
}
