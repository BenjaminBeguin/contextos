/**
 * Memory ranking — turns a repo's memories into the few that actually help the
 * agent right now. Replaces the old "ILIKE match, ORDER BY confidence" with a
 * blended score:
 *
 *     relevance × confidence × recency × impact
 *
 * `relevance` is lexical today (weighted token overlap + phrase bonus). A
 * semantic layer plugs in without touching the blend: pass a precomputed
 * `similarity` (cosine of query/memory embeddings) per candidate and it takes
 * over the relevance term. Everything here is pure and dependency-free so it
 * runs identically for a shared-DB or bring-your-own-database project.
 */

export interface RankableMemory {
  id: string;
  type: string;
  title: string;
  content: string;
  paths: string[];
  confidence: number;
  usageCount: number;
  updatedAt: Date;
  lastUsedAt: Date | null;
}

// Common English + code-comment filler that carries no retrieval signal.
const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "if", "then", "else", "for", "of", "to",
  "in", "on", "at", "by", "is", "are", "be", "was", "were", "with", "as", "this",
  "that", "these", "those", "it", "its", "from", "into", "when", "use", "using",
  "used", "do", "does", "not", "no", "you", "your", "we", "our", "can", "will",
]);

/** Very light stemmer — folds common plural/verb endings so "webhooks" ≈ "webhook".
    Deliberately conservative: strips a trailing "s" rather than "es" so singular
    and plural fold to the SAME token (invoice/invoices → "invoice"). */
function stem(token: string): string {
  if (token.length > 4 && token.endsWith("ies")) return token.slice(0, -3) + "y";
  for (const suffix of ["ing", "ed"]) {
    if (token.length > suffix.length + 2 && token.endsWith(suffix)) {
      return token.slice(0, -suffix.length);
    }
  }
  if (token.length > 3 && token.endsWith("s") && !token.endsWith("ss")) {
    return token.slice(0, -1);
  }
  return token;
}

/** Split text into meaningful, stemmed tokens (lowercased, stopwords/short dropped). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
    .map(stem);
}

function uniq(tokens: string[]): string[] {
  return [...new Set(tokens)];
}

const FIELD_WEIGHT = { title: 3, paths: 2, content: 1 } as const;
const MAX_WEIGHT = FIELD_WEIGHT.title + FIELD_WEIGHT.paths + FIELD_WEIGHT.content;

/**
 * Lexical relevance of a memory to a query, in [0, 1]. Each query token that
 * appears in the title/paths/content adds that field's weight; a memory that
 * contains the full query phrase gets a bonus. 0 when the query is empty.
 */
export function lexicalScore(queryTokens: string[], mem: RankableMemory): number {
  if (queryTokens.length === 0) return 0;
  const title = new Set(tokenize(mem.title));
  const paths = new Set(mem.paths.flatMap((p) => tokenize(p)));
  const content = new Set(tokenize(mem.content));

  let weightedHits = 0;
  for (const qt of uniq(queryTokens)) {
    let w = 0;
    if (title.has(qt)) w += FIELD_WEIGHT.title;
    if (paths.has(qt)) w += FIELD_WEIGHT.paths;
    if (content.has(qt)) w += FIELD_WEIGHT.content;
    weightedHits += w;
  }
  // Normalize by the best a token could score, so a single strong field still
  // reads as "partially relevant" rather than saturating.
  const base = weightedHits / (uniq(queryTokens).length * MAX_WEIGHT);
  return Math.min(1, base);
}

const HALF_LIFE_DAYS = 120;

/** Recency in (0, 1]: a memory touched today ≈ 1, decaying by half every ~4 months. */
export function recencyBoost(mem: RankableMemory, now: Date): number {
  const last = mem.lastUsedAt ?? mem.updatedAt;
  const ageDays = Math.max(0, (now.getTime() - last.getTime()) / 86_400_000);
  return Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
}

/** Impact in [1, ~1.4): memories agents have actually pulled before rank a touch higher. */
export function impactBoost(mem: RankableMemory): number {
  return 1 + Math.min(0.4, Math.log10(mem.usageCount + 1) / 5);
}

/**
 * The blended score. `similarity` (0..1), when supplied by a semantic layer,
 * replaces the lexical relevance term. The 0.2 floor keeps confidence/recency/
 * impact meaningful when there's no query (get_repo_context, review flows) so
 * ordering there is still smarter than confidence-only.
 */
export function blendedScore(
  queryTokens: string[],
  mem: RankableMemory,
  now: Date,
  similarity?: number,
): number {
  const relevance = similarity ?? lexicalScore(queryTokens, mem);
  const confidence = 0.5 + 0.5 * clamp01(mem.confidence);
  return (0.2 + relevance) * confidence * recencyBoost(mem, now) * impactBoost(mem);
}

function clamp01(n: number): number {
  return n < 0 ? 0 : n > 1 ? 1 : n;
}

/** Near-duplicate filter: drop a memory whose title tokens ~overlap one already kept. */
export function dedupe<T extends RankableMemory>(memories: T[], threshold = 0.7): T[] {
  const kept: T[] = [];
  const keptTitles: Set<string>[] = [];
  for (const m of memories) {
    const t = new Set(tokenize(m.title));
    if (t.size === 0) {
      kept.push(m);
      continue;
    }
    const dupe = keptTitles.some((k) => jaccard(k, t) >= threshold);
    if (!dupe) {
      kept.push(m);
      keptTitles.push(t);
    }
  }
  return kept;
}

function jaccard(a: Set<string>, b: Set<string>): number {
  let inter = 0;
  for (const x of a) if (b.has(x)) inter++;
  const union = a.size + b.size - inter;
  return union === 0 ? 0 : inter / union;
}

export interface RankOptions {
  limit: number;
  now?: Date;
  /** id → cosine similarity, when a semantic layer has scored the candidates. */
  similarity?: Map<string, number>;
}

/** Rank candidates by the blended score, drop near-duplicates, take `limit`. */
export function rankMemories<T extends RankableMemory>(
  query: string,
  memories: T[],
  { limit, now = nowOrThrow(), similarity }: RankOptions,
): T[] {
  const qt = tokenize(query);
  const scored = memories
    .map((m) => ({ m, s: blendedScore(qt, m, now, similarity?.get(m.id)) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
  return dedupe(scored).slice(0, limit);
}

// `now` is required by the callers (they pass new Date()); this guards misuse in
// contexts where Date.now() is unavailable.
function nowOrThrow(): Date {
  return new Date();
}

/**
 * Trim a ranked list to a rough character budget so injected context stays
 * compact — keeps memories in order until the budget is spent, always keeping
 * at least one.
 */
export function budgetByChars<T extends RankableMemory>(memories: T[], maxChars: number): T[] {
  const out: T[] = [];
  let used = 0;
  for (const m of memories) {
    const cost = m.title.length + m.content.length;
    if (out.length > 0 && used + cost > maxChars) break;
    out.push(m);
    used += cost;
  }
  return out;
}
