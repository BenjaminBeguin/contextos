import { describe, it, expect } from "vitest";
import { selectKeyFiles, summarizeStructure } from "./scan.js";

describe("selectKeyFiles", () => {
  it("picks high-signal files and ignores ordinary source", () => {
    const paths = [
      "README.md",
      "package.json",
      "apps/web/package.json",
      "prisma/schema.prisma",
      "tsconfig.json",
      "Dockerfile",
      ".github/workflows/ci.yml",
      "src/index.ts",
      "src/utils/helpers.ts",
    ];
    const picked = selectKeyFiles(paths);
    expect(picked).toContain("README.md");
    expect(picked).toContain("package.json");
    expect(picked).toContain("prisma/schema.prisma");
    expect(picked).toContain("Dockerfile");
    expect(picked).toContain(".github/workflows/ci.yml");
    expect(picked).toContain("src/index.ts");
    // ordinary source files are not selected
    expect(picked).not.toContain("src/utils/helpers.ts");
  });

  it("respects the max cap", () => {
    const many = Array.from({ length: 50 }, (_, i) => `pkg${i}/package.json`);
    expect(selectKeyFiles(many, 4).length).toBeLessThanOrEqual(4);
  });
});

describe("summarizeStructure", () => {
  it("reports file count, top dirs, and types", () => {
    const s = summarizeStructure(["src/a.ts", "src/b.ts", "docs/x.md", "README.md"]);
    expect(s).toContain("4 files");
    expect(s).toContain("ts:2");
    expect(s).toMatch(/src/);
  });
});
