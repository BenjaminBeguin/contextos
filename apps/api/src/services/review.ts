import { z } from "zod";
import { complete } from "./llm.js";

export interface ReviewMemory {
  type: string;
  title: string;
  content: string;
  paths: string[];
}

export interface ReviewSkill {
  name: string;
  instructions: string;
  paths: string[];
}

export interface ReviewInput {
  fullName: string;
  prTitle: string;
  prBody: string | null;
  diff: string;
  memories: ReviewMemory[];
  /** Optional repo-specific reviewer guidance set by the team. */
  instructions?: string | null;
  /** Named, reusable reviewer skills attached to this repo. */
  skills?: ReviewSkill[];
}

const findingSchema = z.object({
  severity: z.enum(["blocker", "warning", "nit", "praise"]),
  title: z.string().min(1),
  detail: z.string().min(1),
  path: z.string().optional(),
  /** Line number in the NEW version of the file (right side of the diff) for inline comments. */
  line: z.number().int().positive().optional(),
  memory: z.string().optional(),
});

const reviewSchema = z.object({
  summary: z.string(),
  findings: z.array(findingSchema),
});

export type ReviewFinding = z.infer<typeof findingSchema>;
export type PrReview = z.infer<typeof reviewSchema>;

const SYSTEM = `You are Cortex Reviewer, an automated senior code reviewer for a specific repository.
You are given (1) the team's durable project MEMORIES — approved rules, architecture notes,
known risks, past failures, conventions, commands — and (2) a pull request diff.

Your job: review the diff GROUNDED in those memories. Prioritise:
- Violations of approved project RULES and conventions.
- Changes touching files/areas flagged as RISKS or tied to past FAILURES (match the diff's file
  paths against each memory's "paths" globs).
- Architectural inconsistencies vs. the documented architecture.
- Bugs, security issues, missing tests, and footguns visible in the diff.

Rules:
- Ground findings in the diff and the memories. When a finding relates to a memory, set "memory"
  to that memory's exact title. Do NOT invent project rules that aren't in the memories.
- Be specific: reference the file path and what to change. Prefer a few high-signal findings over noise.
- For each finding, set "path" to the file and "line" to the line number in the NEW version of the
  file (the right/"+" side of the diff — read it from the @@ -old,+new @@ hunk headers). Pick a line
  that actually appears as an added or context line in the diff so the comment can be placed inline.
  Omit "line" only for findings that aren't tied to a specific line.
- severity: "blocker" (must fix), "warning" (should fix), "nit" (minor/style), "praise" (notably good).
- If the diff looks clean, return an empty findings array and say so in the summary.
- Output ONLY a JSON object: {"summary": <1-3 sentence overview>, "findings": [{"severity","title","detail","path"?,"line"?,"memory"?}]}`;

function renderMemories(memories: ReviewMemory[]): string {
  if (memories.length === 0) return "(no approved memories for this repo yet)";
  return memories
    .map((m) => {
      const paths = m.paths.length ? ` [paths: ${m.paths.join(", ")}]` : "";
      return `- (${m.type}) ${m.title}${paths}: ${m.content}`;
    })
    .join("\n");
}

function render(input: ReviewInput): string {
  const parts = [
    `Repository: ${input.fullName}`,
    `Pull request: ${input.prTitle}`,
  ];
  if (input.prBody) parts.push(`PR description:\n${input.prBody.slice(0, 2000)}`);
  if (input.instructions) parts.push(`Team reviewer instructions:\n${input.instructions}`);
  if (input.skills?.length) {
    parts.push(
      "Reviewer skills (apply each; a skill scoped to paths applies mainly to matching files):\n" +
        input.skills
          .map(
            (s) =>
              `### ${s.name}${s.paths.length ? ` [paths: ${s.paths.join(", ")}]` : ""}\n${s.instructions}`,
          )
          .join("\n\n"),
    );
  }
  parts.push(`Project memories:\n${renderMemories(input.memories)}`);
  parts.push(`Diff (truncated if large):\n${input.diff.slice(0, 60000)}`);
  return parts.join("\n\n");
}

function parseJsonObject(raw: string): unknown {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

/** Generate a memory-grounded review of a pull request diff. Requires an LLM key. */
export async function reviewPullRequest(input: ReviewInput, apiKey: string): Promise<PrReview> {
  const raw = await complete(apiKey, SYSTEM, render(input), 2048);
  const parsed = reviewSchema.safeParse(parseJsonObject(raw));
  if (parsed.success) return parsed.data;
  return { summary: raw.trim().slice(0, 1000) || "No review produced.", findings: [] };
}

const SEVERITY_LABEL: Record<ReviewFinding["severity"], string> = {
  blocker: "🔴 Blocker",
  warning: "🟡 Warning",
  nit: "🔵 Nit",
  praise: "🟢 Praise",
};

/** Render a review as a Markdown PR comment. */
export function formatReviewComment(review: PrReview): string {
  const lines = ["### 🧠 Cortex Reviewer", "", review.summary || "_No summary._"];
  if (review.findings.length > 0) {
    lines.push("");
    for (const f of review.findings) {
      const where = f.path ? ` \`${f.path}${f.line ? `:${f.line}` : ""}\`` : "";
      const mem = f.memory ? ` _(memory: ${f.memory})_` : "";
      lines.push(`- **${SEVERITY_LABEL[f.severity]}**${where}: ${f.title}${mem}`);
      if (f.detail) lines.push(`  ${f.detail}`);
    }
  }
  lines.push("", "_Grounded in this repo's approved Cortex memories._");
  return lines.join("\n");
}
