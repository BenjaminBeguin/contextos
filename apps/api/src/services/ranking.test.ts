import { describe, it, expect } from "vitest";
import {
  tokenize,
  lexicalScore,
  recencyBoost,
  impactBoost,
  rankMemories,
  dedupe,
  budgetByChars,
  type RankableMemory,
} from "./ranking.js";

const NOW = new Date("2026-07-09T00:00:00Z");

function mem(p: Partial<RankableMemory> & { id: string; title: string }): RankableMemory {
  return {
    id: p.id,
    type: p.type ?? "risk",
    title: p.title,
    content: p.content ?? "",
    paths: p.paths ?? [],
    confidence: p.confidence ?? 0.7,
    usageCount: p.usageCount ?? 0,
    updatedAt: p.updatedAt ?? NOW,
    lastUsedAt: p.lastUsedAt ?? null,
  };
}

describe("tokenize", () => {
  it("lowercases, drops stopwords/short tokens, and stems", () => {
    expect(tokenize("The webhooks are FAILING on invoices")).toEqual([
      "webhook",
      "fail",
      "invoice",
    ]);
  });
});

describe("lexicalScore", () => {
  it("is 0 for an empty query", () => {
    expect(lexicalScore([], mem({ id: "1", title: "anything" }))).toBe(0);
  });

  it("matches a paraphrase via stemming", () => {
    const m = mem({ id: "1", title: "Stripe webhook idempotency", content: "check idempotency keys" });
    expect(lexicalScore(tokenize("webhooks"), m)).toBeGreaterThan(0);
  });

  it("weights a title hit above a content-only hit", () => {
    const inTitle = mem({ id: "1", title: "billing timeout", content: "unrelated" });
    const inContent = mem({ id: "2", title: "unrelated", content: "billing timeout happens" });
    const q = tokenize("billing timeout");
    expect(lexicalScore(q, inTitle)).toBeGreaterThan(lexicalScore(q, inContent));
  });
});

describe("recencyBoost / impactBoost", () => {
  it("decays with age", () => {
    const fresh = mem({ id: "1", title: "x", lastUsedAt: NOW });
    const old = mem({ id: "2", title: "x", lastUsedAt: new Date("2025-07-09T00:00:00Z") });
    expect(recencyBoost(fresh, NOW)).toBeGreaterThan(recencyBoost(old, NOW));
  });

  it("rewards proven memories but stays bounded", () => {
    expect(impactBoost(mem({ id: "1", title: "x", usageCount: 0 }))).toBe(1);
    const heavy = impactBoost(mem({ id: "2", title: "x", usageCount: 10_000 }));
    expect(heavy).toBeGreaterThan(1);
    expect(heavy).toBeLessThanOrEqual(1.4);
  });
});

describe("rankMemories", () => {
  it("ranks an exact query match above a higher-confidence irrelevant memory", () => {
    const relevant = mem({ id: "rel", title: "billing timeout", confidence: 0.6 });
    const confident = mem({ id: "conf", title: "unrelated deploy note", confidence: 0.99 });
    const ranked = rankMemories("billing timeout", [confident, relevant], { limit: 2, now: NOW });
    expect(ranked[0]!.id).toBe("rel");
  });

  it("falls back to confidence×recency×impact when there is no query", () => {
    const low = mem({ id: "low", title: "note a", confidence: 0.5 });
    const high = mem({ id: "high", title: "note b", confidence: 0.95 });
    const ranked = rankMemories("", [low, high], { limit: 2, now: NOW });
    expect(ranked[0]!.id).toBe("high");
  });

  it("lets a semantic similarity override lexical relevance", () => {
    const lexicalMatch = mem({ id: "lex", title: "billing timeout" });
    const semanticMatch = mem({ id: "sem", title: "invoice suite hangs" });
    const ranked = rankMemories("billing timeout", [lexicalMatch, semanticMatch], {
      limit: 2,
      now: NOW,
      similarity: new Map([["sem", 0.99]]),
    });
    expect(ranked[0]!.id).toBe("sem");
  });
});

describe("dedupe", () => {
  it("drops near-duplicate titles, keeping the first (higher-ranked)", () => {
    const a = mem({ id: "a", title: "run migrations locally" });
    const b = mem({ id: "b", title: "run migrations locally now" });
    const c = mem({ id: "c", title: "completely different subject" });
    const out = dedupe([a, b, c]);
    expect(out.map((m) => m.id)).toEqual(["a", "c"]);
  });
});

describe("budgetByChars", () => {
  it("stops once the budget is spent but always keeps one", () => {
    const big = mem({ id: "a", title: "t", content: "x".repeat(100) });
    const more = mem({ id: "b", title: "t", content: "y".repeat(100) });
    expect(budgetByChars([big, more], 50).map((m) => m.id)).toEqual(["a"]);
  });
});
