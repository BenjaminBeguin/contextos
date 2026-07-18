import { describe, it, expect } from "vitest";
import { normalizeRepoIdentifier } from "./repoResolve.js";

describe("normalizeRepoIdentifier", () => {
  it("normalizes every common git remote form to owner/repo", () => {
    const forms = [
      "git@github.com:BenjaminBeguin/memmo.git",
      "https://github.com/BenjaminBeguin/memmo",
      "https://github.com/BenjaminBeguin/memmo.git",
      "ssh://git@github.com/BenjaminBeguin/memmo",
      "BenjaminBeguin/memmo",
      "  BenjaminBeguin/Memmo  ",
    ];
    for (const f of forms) {
      expect(normalizeRepoIdentifier(f), f).toBe("benjaminbeguin/memmo");
    }
  });

  it("keeps only the last two path segments (host/group prefixes dropped)", () => {
    expect(normalizeRepoIdentifier("https://gitlab.com/group/sub/owner/repo")).toBe("owner/repo");
  });

  it("a bare local path won't match a real owner/repo", () => {
    // /home/user/memmo → "user/memmo", which is not "benjaminbeguin/memmo"
    expect(normalizeRepoIdentifier("/home/user/memmo")).not.toBe("benjaminbeguin/memmo");
  });
});
