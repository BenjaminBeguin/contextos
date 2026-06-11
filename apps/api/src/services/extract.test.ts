import { describe, it, expect } from "vitest";
import { extractMemories } from "./extract.js";

// Called without an API key → deterministic heuristic path (offline).

describe("extractMemories (heuristic fallback)", () => {
  it("returns an empty array for an empty session", async () => {
    const out = await extractMemories({ agent: "claude-code" });
    expect(out).toEqual([]);
  });

  it("proposes a failure memory from errors", async () => {
    const out = await extractMemories({
      agent: "claude-code",
      errors: ["TypeError: cannot read property x of undefined"],
    });
    expect(out.some((m) => m.type === "failure")).toBe(true);
  });

  it("classifies test/deploy commands and ignores noise", async () => {
    const out = await extractMemories({
      agent: "claude-code",
      commandsRun: ["pnpm test", "echo hello"],
    });
    expect(out.some((m) => m.type === "testing")).toBe(true);
    expect(out.some((m) => m.content.includes("echo hello"))).toBe(false);
  });

  it("never returns more than 4 drafts", async () => {
    const out = await extractMemories({
      agent: "claude-code",
      errors: ["e1", "e2", "e3", "e4", "e5"],
    });
    expect(out.length).toBeLessThanOrEqual(4);
  });
});
