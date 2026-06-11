import { extractedMemoriesSchema, type ExtractedMemory } from "@cortex/shared";
import { llmEnabled, complete } from "./llm.js";

export interface ScanInput {
  fullName: string;
  stack: string[];
  packageManager: string | null;
  readme: string | null;
  packageJson: string | null;
  structure: string[];
}

const SYSTEM = `You analyze a software repository and extract durable operational memories that a new
AI coding agent should know BEFORE working in it.

A good memory is reusable, specific, and high-signal: architecture facts, key commands
(build/test/lint/deploy), project conventions, important dependencies, testing/deployment
practices, or obvious risks.

Rules:
- Use ONLY the provided material (README, manifest, structure, stack). Do not invent.
- Prefer 3-6 memories. Skip generic boilerplate.
- Set confidence 0..1 by how certain and reusable each memory is.

Memory types: project_rule, architecture, command, workflow, decision, failure, risk,
dependency, testing, deployment, business_context.

Output ONLY a JSON array. Each item:
{"type": <type>, "title": <short title>, "content": <the memory>, "confidence": <0..1>, "evidence": <optional short quote>}`;

function render(input: ScanInput): string {
  const parts: string[] = [`Repository: ${input.fullName}`];
  if (input.stack.length) parts.push(`Detected stack: ${input.stack.join(", ")}`);
  if (input.packageManager) parts.push(`Package manager: ${input.packageManager}`);
  if (input.structure.length) parts.push(`Top-level entries:\n- ${input.structure.join("\n- ")}`);
  if (input.packageJson) parts.push(`package.json:\n${input.packageJson.slice(0, 2500)}`);
  if (input.readme) parts.push(`README:\n${input.readme.slice(0, 5000)}`);
  return parts.join("\n\n");
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
function heuristic(input: ScanInput): ExtractedMemory[] {
  const out: ExtractedMemory[] = [];

  if (input.stack.length || input.packageManager) {
    out.push({
      type: "architecture",
      title: "Project stack",
      content:
        `${input.fullName} uses ${input.stack.join(", ") || "an unspecified stack"}` +
        (input.packageManager ? ` with ${input.packageManager}.` : "."),
      confidence: 0.6,
    });
  }

  // Commands from package.json scripts.
  if (input.packageJson) {
    try {
      const pkg = JSON.parse(input.packageJson) as { scripts?: Record<string, string> };
      const scripts = Object.keys(pkg.scripts ?? {});
      if (scripts.length) {
        const pm = input.packageManager ?? "npm";
        out.push({
          type: "command",
          title: "Available scripts",
          content: `Run scripts with \`${pm} run <name>\`. Defined: ${scripts.join(", ")}.`,
          confidence: 0.55,
        });
      }
    } catch {
      /* ignore */
    }
  }

  // README first heading/paragraph as business context.
  if (input.readme) {
    const summary = input.readme
      .split("\n")
      .map((l) => l.replace(/^#+\s*/, "").trim())
      .find((l) => l.length > 20);
    if (summary) {
      out.push({
        type: "business_context",
        title: "What this repo is",
        content: summary.slice(0, 400),
        confidence: 0.5,
      });
    }
  }

  return out.slice(0, 6);
}

export async function scanRepo(input: ScanInput): Promise<ExtractedMemory[]> {
  if (llmEnabled) {
    try {
      const raw = await complete(SYSTEM, render(input), 1500);
      const parsed = extractedMemoriesSchema.safeParse(parseJsonArray(raw));
      if (parsed.success && parsed.data.length > 0) return parsed.data;
    } catch {
      // fall through to heuristic
    }
  }
  return heuristic(input);
}
