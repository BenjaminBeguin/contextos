import { describe, it, expect } from "vitest";
import {
  createMemorySchema,
  recordSessionSchema,
  waitlistSchema,
  mcpSearchMemorySchema,
  extractedMemoriesSchema,
} from "./schemas.js";

describe("createMemorySchema", () => {
  it("applies defaults for scope/confidence/status", () => {
    const parsed = createMemorySchema.parse({
      type: "command",
      title: "Run tests",
      content: "Use make test-billing",
    });
    expect(parsed.scope).toBe("repo");
    expect(parsed.confidence).toBe(0.7);
    expect(parsed.status).toBe("proposed");
  });

  it("rejects an invalid memory type", () => {
    expect(() =>
      createMemorySchema.parse({ type: "nonsense", title: "x", content: "y" }),
    ).toThrow();
  });

  it("rejects confidence out of range", () => {
    expect(() =>
      createMemorySchema.parse({ type: "risk", title: "x", content: "y", confidence: 2 }),
    ).toThrow();
  });
});

describe("recordSessionSchema", () => {
  it("defaults the agent and accepts optional arrays", () => {
    const parsed = recordSessionSchema.parse({
      summary: "Did a thing",
      commandsRun: ["pnpm test"],
    });
    expect(parsed.agent).toBe("claude-code");
    expect(parsed.commandsRun).toEqual(["pnpm test"]);
  });
});

describe("mcpSearchMemorySchema", () => {
  it("defaults query and limit", () => {
    const parsed = mcpSearchMemorySchema.parse({ repoId: "r1" });
    expect(parsed.query).toBe("");
    expect(parsed.limit).toBe(10);
  });
});

describe("waitlistSchema", () => {
  it("requires a valid email", () => {
    expect(() => waitlistSchema.parse({ email: "not-an-email" })).toThrow();
    expect(waitlistSchema.parse({ email: "a@b.com" }).email).toBe("a@b.com");
  });
});

describe("extractedMemoriesSchema", () => {
  it("accepts a valid extractor array and caps the count at 20", () => {
    const one = [{ type: "decision", title: "t", content: "c", confidence: 0.5 }];
    expect(extractedMemoriesSchema.parse(one)).toHaveLength(1);
    const tooMany = Array.from({ length: 21 }, () => one[0]);
    expect(() => extractedMemoriesSchema.parse(tooMany)).toThrow();
  });
});
