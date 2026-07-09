/**
 * Memory health — keeps a repo's memory trustworthy as it grows. Two signals:
 *
 *  - Staleness: an approved memory that hasn't been used or updated in a long
 *    time is likely describing code that has since moved on. We don't delete it
 *    (retrieval already deprioritizes it via recency decay); we surface it so a
 *    human can re-validate or prune.
 *  - Conflicts: two approved memories of the same kind with near-identical
 *    subjects. Either a duplicate to merge, or a contradiction where the agent
 *    would get whichever one ranked higher — both worth resolving by hand.
 *
 * Pure and dependency-free (reuses the retrieval tokenizer), so it runs the same
 * for a shared-DB or bring-your-own-database project.
 */
import { tokenize } from "./ranking.js";

export interface HealthMemory {
  id: string;
  type: string;
  title: string;
  content: string;
  paths: string[];
  status: string;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

export type Staleness = "fresh" | "aging" | "stale";

const AGING_DAYS = 90;
const STALE_DAYS = 180;

/** How long since a memory was last used or updated. */
function ageDays(mem: HealthMemory, now: Date): number {
  const last = mem.lastUsedAt ?? mem.updatedAt;
  return Math.max(0, (now.getTime() - last.getTime()) / 86_400_000);
}

/** Classify a memory by how long it's gone without being used or touched. */
export function classifyStaleness(mem: HealthMemory, now: Date): Staleness {
  const age = ageDays(mem, now);
  if (age >= STALE_DAYS) return "stale";
  if (age >= AGING_DAYS) return "aging";
  return "fresh";
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

function normalize(text: string): string {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

export interface Conflict {
  a: { id: string; title: string };
  b: { id: string; title: string };
  /** "duplicate" when the content is identical, "divergent" when it differs. */
  kind: "duplicate" | "divergent";
  /** Title-token similarity (0..1) — how confident we are they're about the same thing. */
  similarity: number;
}

const TITLE_SIM_THRESHOLD = 0.5;

/**
 * Find pairs of approved memories that are about the same thing. Same type +
 * high title-token overlap. Identical content → a duplicate to merge; differing
 * content → a divergence to reconcile. Sorted most-similar first.
 */
export function findConflicts(memories: HealthMemory[]): Conflict[] {
  const approved = memories.filter((m) => m.status === "approved");
  const tokens = approved.map((m) => new Set(tokenize(m.title)));
  const conflicts: Conflict[] = [];
  for (let i = 0; i < approved.length; i++) {
    for (let j = i + 1; j < approved.length; j++) {
      const a = approved[i]!;
      const b = approved[j]!;
      if (a.type !== b.type) continue;
      const sim = jaccard(tokens[i]!, tokens[j]!);
      if (sim < TITLE_SIM_THRESHOLD) continue;
      const kind = normalize(a.content) === normalize(b.content) ? "duplicate" : "divergent";
      conflicts.push({
        a: { id: a.id, title: a.title },
        b: { id: b.id, title: b.title },
        kind,
        similarity: sim,
      });
    }
  }
  return conflicts.sort((x, y) => y.similarity - x.similarity);
}

export interface MemoryHealth {
  approvedCount: number;
  fresh: number;
  aging: number;
  stale: number;
  staleMemories: { id: string; title: string; type: string; ageDays: number }[];
  conflicts: Conflict[];
}

/** Full health report for a repo's approved memories. */
export function memoryHealth(memories: HealthMemory[], now: Date): MemoryHealth {
  const approved = memories.filter((m) => m.status === "approved");
  const buckets = { fresh: 0, aging: 0, stale: 0 };
  const staleMemories: MemoryHealth["staleMemories"] = [];
  for (const m of approved) {
    const s = classifyStaleness(m, now);
    buckets[s]++;
    if (s === "stale") {
      staleMemories.push({
        id: m.id,
        title: m.title,
        type: m.type,
        ageDays: Math.round(ageDays(m, now)),
      });
    }
  }
  staleMemories.sort((a, b) => b.ageDays - a.ageDays);
  return {
    approvedCount: approved.length,
    fresh: buckets.fresh,
    aging: buckets.aging,
    stale: buckets.stale,
    staleMemories,
    conflicts: findConflicts(approved),
  };
}
