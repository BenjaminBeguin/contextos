import { extractedMemoriesSchema, type ExtractedMemory } from "@cortex/shared";
import { llmEnabled, complete } from "./llm.js";

export interface ScanFile {
  path: string;
  content: string;
}

export interface ScanInput {
  fullName: string;
  stack: string[];
  packageManager: string | null;
  structure: string;
  files: ScanFile[];
}

// High-signal files to read, in priority order. `limit` caps matches per pattern.
const FILE_PATTERNS: { re: RegExp; limit: number }[] = [
  { re: /(^|\/)readme\.md$/i, limit: 2 },
  { re: /(^|\/)(architecture|design|overview)\.md$/i, limit: 2 },
  { re: /(^|\/)contributing\.md$/i, limit: 1 },
  { re: /(^|\/)claude\.md$/i, limit: 2 },
  { re: /(^|\/)agents?\.md$/i, limit: 1 },
  { re: /(^|\/)\.cursorrules$/i, limit: 1 },
  { re: /(^|\/)package\.json$/, limit: 3 },
  { re: /(^|\/)pnpm-workspace\.yaml$/, limit: 1 },
  { re: /(^|\/)(turbo|nx)\.json$/, limit: 1 },
  { re: /(^|\/)prisma\/schema\.prisma$/, limit: 1 },
  { re: /(^|\/)tsconfig.*\.json$/, limit: 1 },
  { re: /(^|\/)dockerfile$/i, limit: 1 },
  { re: /(^|\/)docker-compose.*\.ya?ml$/, limit: 1 },
  { re: /\.github\/workflows\/.*\.ya?ml$/, limit: 2 },
  { re: /(^|\/)makefile$/i, limit: 1 },
  { re: /(^|\/)(pyproject\.toml|requirements\.txt|Pipfile|setup\.py)$/, limit: 2 },
  { re: /(^|\/)(cargo\.toml|go\.mod|build\.gradle|pom\.xml|composer\.json|gemfile)$/i, limit: 1 },
  { re: /(^|\/)\.env\.example$/, limit: 1 },
  { re: /(^|\/)src\/(index|main|app|server)\.[a-z]+$/i, limit: 2 },
];

/** Pick the most informative files from a repo's file list (shallowest first). */
export function selectKeyFiles(paths: string[], max = 16): string[] {
  const byDepth = [...paths].sort(
    (a, b) => a.split("/").length - b.split("/").length || a.localeCompare(b),
  );
  const picked: string[] = [];
  const seen = new Set<string>();
  for (const { re, limit } of FILE_PATTERNS) {
    let n = 0;
    for (const p of byDepth) {
      if (n >= limit || picked.length >= max) break;
      if (!seen.has(p) && re.test(p)) {
        picked.push(p);
        seen.add(p);
        n++;
      }
    }
    if (picked.length >= max) break;
  }
  return picked;
}

/** One-line-ish summary of repo structure: top dirs + file-type histogram. */
export function summarizeStructure(paths: string[]): string {
  const topDirs = new Set<string>();
  const ext: Record<string, number> = {};
  for (const p of paths) {
    if (p.includes("/")) topDirs.add(p.split("/")[0]!);
    const m = p.match(/\.([a-z0-9]+)$/i);
    if (m) {
      const e = m[1]!.toLowerCase();
      ext[e] = (ext[e] ?? 0) + 1;
    }
  }
  const types = Object.entries(ext)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([e, c]) => `${e}:${c}`);
  return `${paths.length} files. Top-level: ${[...topDirs].slice(0, 30).join(", ") || "(flat)"}. File types: ${types.join(", ")}.`;
}

const SYSTEM = `You analyze a software repository and extract durable operational memories a new
AI coding agent should know BEFORE working in it.

Good memories are reusable, specific, and high-signal: architecture & module layout, key
commands (build/test/lint/deploy), project conventions/rules, important dependencies and
services, data model facts, testing/deployment practices, and obvious risks or gotchas.

Rules:
- Use ONLY the provided material (structure, file contents, stack). Do NOT invent.
- Prefer 5-10 memories. Each must be specific and self-contained. Skip generic boilerplate.
- When a memory applies to specific files/areas, add their path globs in "paths" (e.g. "src/billing/**").
- Set confidence 0..1 by certainty and reusability.

Memory types: project_rule, architecture, command, workflow, decision, failure, risk,
dependency, testing, deployment, business_context.

Output ONLY a JSON array. Each item:
{"type": <type>, "title": <short title>, "content": <the memory>, "confidence": <0..1>, "paths": <optional string[]>, "evidence": <optional short quote>}`;

function render(input: ScanInput): string {
  const parts: string[] = [`Repository: ${input.fullName}`];
  if (input.stack.length) parts.push(`Stack: ${input.stack.join(", ")}`);
  if (input.packageManager) parts.push(`Package manager: ${input.packageManager}`);
  parts.push(`Structure: ${input.structure}`);
  for (const f of input.files) {
    parts.push(`--- ${f.path} ---\n${f.content.slice(0, 5000)}`);
  }
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
        (input.packageManager ? ` with ${input.packageManager}.` : ".") +
        ` Structure: ${input.structure}`,
      confidence: 0.6,
    });
  }

  const rootPkg = input.files.find((f) => f.path === "package.json");
  if (rootPkg) {
    try {
      const pkg = JSON.parse(rootPkg.content) as { scripts?: Record<string, string> };
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

  const readme = input.files.find((f) => /readme\.md$/i.test(f.path));
  if (readme) {
    const summary = readme.content
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

  if (input.files.some((f) => /prisma\/schema\.prisma$/.test(f.path))) {
    out.push({
      type: "architecture",
      title: "Uses Prisma",
      content: "Data model is defined in prisma/schema.prisma; run migrations after schema changes.",
      confidence: 0.5,
      paths: ["prisma/schema.prisma"],
    });
  }

  return out.slice(0, 12);
}

export async function scanRepo(input: ScanInput): Promise<ExtractedMemory[]> {
  if (llmEnabled && input.files.length > 0) {
    try {
      const raw = await complete(SYSTEM, render(input), 2500);
      const parsed = extractedMemoriesSchema.safeParse(parseJsonArray(raw));
      if (parsed.success && parsed.data.length > 0) return parsed.data;
    } catch {
      // fall through to heuristic
    }
  }
  return heuristic(input);
}
