/**
 * Pure helpers for turning Memmo review findings into a GitHub pull-request review
 * with inline comments — plus diff parsing and dedup so re-runs stay quiet.
 */
import { type Finding, type ReviewSeverity, findingKey } from "@memmo/shared";

export { type Finding, type ReviewSeverity, findingKey };

export interface InlineComment {
  path: string;
  line: number;
  side: "RIGHT";
  body: string;
}

const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  blocker: "🔴 Blocker",
  warning: "🟡 Warning",
  nit: "🔵 Nit",
  praise: "🟢 Praise",
};

/**
 * Parse a unified diff into the set of NEW-side line numbers per file that can carry
 * an inline review comment (added `+` and context ` ` lines on the right side).
 */
export function parseDiffNewLines(diff: string): Map<string, Set<number>> {
  const out = new Map<string, Set<number>>();
  let path: string | null = null;
  let newLine = 0;
  let inHunk = false;

  for (const raw of diff.split("\n")) {
    if (raw.startsWith("+++ ")) {
      // "+++ b/path" (or "+++ /dev/null" for deletes)
      const p = raw.slice(4).replace(/^b\//, "");
      path = p === "/dev/null" ? null : p;
      if (path && !out.has(path)) out.set(path, new Set());
      inHunk = false;
      continue;
    }
    const hunk = raw.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (hunk) {
      newLine = parseInt(hunk[1]!, 10);
      inHunk = true;
      continue;
    }
    if (!inHunk || !path) continue;
    if (raw.startsWith("-")) continue; // old side only — not commentable on the right
    if (raw.startsWith("+") || raw.startsWith(" ")) {
      out.get(path)!.add(newLine);
      newLine++;
    } else if (raw.startsWith("\\")) {
      // "\ No newline at end of file" — no line advance
    } else {
      inHunk = false; // left the hunk body
    }
  }
  return out;
}

const MARKER_RE = /<!-- memmo-review:(.+?) -->/g;

/** Collect memmo dedup keys already present in existing comment bodies. */
export function extractMarkers(bodies: string[]): Set<string> {
  const keys = new Set<string>();
  for (const b of bodies) {
    for (const m of b.matchAll(MARKER_RE)) keys.add(m[1]!);
  }
  return keys;
}

function findingLine(f: Finding): string {
  const mem = f.memory ? ` _(memory: ${f.memory})_` : "";
  return `**${SEVERITY_LABEL[f.severity]}** ${f.title}${mem}\n\n${f.detail}`;
}

export interface ReviewPayload {
  body: string;
  event: "COMMENT";
  comments: InlineComment[];
  /** Number of findings that are genuinely new (after dedup). */
  newCount: number;
}

/**
 * Build a GitHub review payload from findings: place each finding inline when its
 * (path, line) is commentable, fold the rest into the body, and drop findings already
 * posted (present in `existingKeys`).
 */
export function buildReviewPayload(
  summary: string,
  findings: Finding[],
  commentable: Map<string, Set<number>>,
  existingKeys: Set<string> = new Set(),
): ReviewPayload {
  const fresh = findings.filter((f) => !existingKeys.has(findingKey(f)));
  const comments: InlineComment[] = [];
  const leftover: Finding[] = [];

  for (const f of fresh) {
    if (f.path && f.line && commentable.get(f.path)?.has(f.line)) {
      comments.push({
        path: f.path,
        line: f.line,
        side: "RIGHT",
        body: `${findingLine(f)}\n\n<!-- memmo-review:${findingKey(f)} -->`,
      });
    } else {
      leftover.push(f);
    }
  }

  const bodyParts = ["### 🧠 Memmo Reviewer", "", summary || "_No summary._"];
  if (leftover.length > 0) {
    bodyParts.push("");
    for (const f of leftover) {
      const where = f.path ? ` \`${f.path}${f.line ? `:${f.line}` : ""}\`` : "";
      const mem = f.memory ? ` _(memory: ${f.memory})_` : "";
      bodyParts.push(`- **${SEVERITY_LABEL[f.severity]}**${where}: ${f.title}${mem}`);
      if (f.detail) bodyParts.push(`  ${f.detail}`);
      bodyParts.push(`  <!-- memmo-review:${findingKey(f)} -->`);
    }
  }
  bodyParts.push("", "_Grounded in this repo's approved Memmo memories._");

  return { body: bodyParts.join("\n"), event: "COMMENT", comments, newCount: fresh.length };
}
