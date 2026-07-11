import { describe, it, expect } from "vitest";
import { normalizeRepoIdentifier } from "./repoResolve.js";

describe("normalizeRepoIdentifier", () => {
  it("normalizes every common git remote form to owner/repo", () => {
    const forms = [
      "git@github.com:BenjaminBeguin/contextos.git",
      "https://github.com/BenjaminBeguin/contextos",
      "https://github.com/BenjaminBeguin/contextos.git",
      "ssh://git@github.com/BenjaminBeguin/contextos",
      "BenjaminBeguin/contextos",
      "  BenjaminBeguin/Contextos  ",
    ];
    for (const f of forms) {
      expect(normalizeRepoIdentifier(f), f).toBe("benjaminbeguin/contextos");
    }
  });

  it("keeps only the last two path segments (host/group prefixes dropped)", () => {
    expect(normalizeRepoIdentifier("https://gitlab.com/group/sub/owner/repo")).toBe("owner/repo");
  });

  it("a bare local path won't match a real owner/repo", () => {
    // /home/user/contextos → "user/contextos", which is not "benjaminbeguin/contextos"
    expect(normalizeRepoIdentifier("/home/user/contextos")).not.toBe("benjaminbeguin/contextos");
  });
});
