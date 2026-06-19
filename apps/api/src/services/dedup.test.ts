import { describe, it, expect } from "vitest";
import { tokenize, similarity, findDuplicate, partitionNew, type MemoryLike } from "./dedup.js";

const m = (type: string, title: string, content: string): MemoryLike => ({ type, title, content });

describe("tokenize", () => {
  it("lowercases, strips punctuation, drops stopwords and short tokens", () => {
    const t = tokenize("Run the Billing tests, before you deploy!");
    expect(t.has("billing")).toBe(true);
    expect(t.has("tests")).toBe(true);
    expect(t.has("deploy")).toBe(true);
    expect(t.has("the")).toBe(false); // stopword
    expect(t.has("you")).toBe(false); // stopword
  });
});

describe("similarity", () => {
  it("is ~1 for identical memories and low for unrelated ones", () => {
    const a = m("command", "Run billing tests", "Use make test-billing before a PR");
    expect(similarity(a, a)).toBeGreaterThan(0.95);
    const b = m("architecture", "Frontend uses Next.js App Router", "Pages live in apps/web/app");
    expect(similarity(a, b)).toBeLessThan(0.2);
  });

  it("discounts when the type differs", () => {
    const a = m("command", "Run billing tests", "make test-billing");
    const sameType = m("command", "Run billing tests", "make test-billing");
    const diffType = m("testing", "Run billing tests", "make test-billing");
    expect(similarity(a, sameType)).toBeGreaterThan(similarity(a, diffType));
  });
});

describe("findDuplicate", () => {
  it("matches a near-duplicate and ignores distinct memories", () => {
    const existing = [
      m("command", "Run billing tests", "Use make test-billing before opening a PR"),
      m("risk", "Do not edit invoices_v1", "Legacy billing tables, read-only"),
    ];
    const dup = m("command", "Running the billing tests", "Run make test-billing prior to a PR");
    expect(findDuplicate(existing, dup)).not.toBeNull();

    const distinct = m("deployment", "Deploy with Railway", "Push to main triggers a deploy");
    expect(findDuplicate(existing, distinct)).toBeNull();
  });
});

describe("partitionNew", () => {
  it("skips duplicates against existing and within the batch", () => {
    const existing = [
      { id: "1", status: "approved", ...m("command", "Run tests", "Use pnpm test") },
    ];
    const candidates = [
      m("command", "Run the tests", "Use pnpm test to run the suite"), // dup of existing
      m("architecture", "Monorepo layout", "pnpm workspaces with apps and packages"), // new
      m("architecture", "Monorepo structure", "pnpm workspaces: apps and packages"), // dup of prev candidate
    ];
    const { fresh, skipped } = partitionNew(existing, candidates);
    expect(fresh).toHaveLength(1);
    expect(fresh[0]!.title).toBe("Monorepo layout");
    expect(skipped).toBe(2);
  });
});
