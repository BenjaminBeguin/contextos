import { memoryStoreForRepo } from "./memoryStore.js";

export interface MemoryLike {
  type: string;
  title: string;
  content: string;
}

const STOP = new Set([
  "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "with", "is", "are", "be",
  "this", "that", "it", "as", "at", "by", "from", "into", "use", "using", "run", "you", "your",
  "we", "our", "when", "before", "after", "via",
]);

/** Lowercase word set, punctuation stripped, short/stopwords removed. */
export function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter((w) => w.length > 2 && !STOP.has(w)),
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 && b.size === 0) return 1;
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

/** 0..1 similarity weighting title heavily, content as support; same type reinforces. */
export function similarity(a: MemoryLike, b: MemoryLike): number {
  const titleSim = jaccard(tokenize(a.title), tokenize(b.title));
  const contentSim = jaccard(tokenize(a.content), tokenize(b.content));
  const base = titleSim * 0.6 + contentSim * 0.4;
  return a.type === b.type ? base : base * 0.7;
}

/** Default cutoff for treating two memories as the same thing. */
export const DUP_THRESHOLD = 0.6;

/** The most similar existing memory at/above the threshold, or null. */
export function findDuplicate<T extends MemoryLike>(
  existing: T[],
  candidate: MemoryLike,
  threshold = DUP_THRESHOLD,
): T | null {
  let best: T | null = null;
  let bestScore = threshold;
  for (const e of existing) {
    const s = similarity(e, candidate);
    if (s >= bestScore) {
      bestScore = s;
      best = e;
    }
  }
  return best;
}

export interface DedupMemory {
  id: string;
  type: string;
  title: string;
  content: string;
  status: string;
}

/** Existing proposed + approved memories for a repo, for duplicate checks.
    Routed through the workspace's memory store (BYODB-aware). */
export async function loadDedupSet(repoId: string): Promise<DedupMemory[]> {
  const { store } = await memoryStoreForRepo(repoId);
  const rows = await store.listByRepo(repoId);
  return rows
    .filter((m) => m.status === "proposed" || m.status === "approved")
    .map((m) => ({ id: m.id, type: m.type, title: m.title, content: m.content, status: m.status }));
}

/**
 * Split candidate memories into ones to create and ones to skip as duplicates —
 * checking against both existing memories and earlier candidates in the batch.
 */
export function partitionNew<T extends MemoryLike>(
  existing: DedupMemory[],
  candidates: T[],
  threshold = DUP_THRESHOLD,
): { fresh: T[]; skipped: number } {
  const seen: MemoryLike[] = [...existing];
  const fresh: T[] = [];
  let skipped = 0;
  for (const c of candidates) {
    if (findDuplicate(seen, c, threshold)) {
      skipped++;
      continue;
    }
    fresh.push(c);
    seen.push(c);
  }
  return { fresh, skipped };
}
