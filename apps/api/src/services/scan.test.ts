import { describe, it, expect } from "vitest";
import { selectKeyFiles, selectSourceFiles, summarizeStructure } from "./scan.js";

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

describe("selectSourceFiles", () => {
  it("samples source files, prioritizing important ones, skipping tests/dist", () => {
    const paths = [
      "apps/api/src/server.ts",
      "apps/api/src/routes/auth.ts",
      "apps/api/src/routes/repos.ts",
      "apps/api/src/utils/x.ts",
      "apps/api/src/server.test.ts",
      "dist/bundle.js",
      "node_modules/foo/index.js",
      "README.md",
    ];
    const picked = selectSourceFiles(paths);
    expect(picked).toContain("apps/api/src/server.ts");
    expect(picked).not.toContain("apps/api/src/server.test.ts");
    expect(picked).not.toContain("dist/bundle.js");
    expect(picked).not.toContain("node_modules/foo/index.js");
    expect(picked).not.toContain("README.md"); // not a source file here
  });

  it("respects per-directory and total caps", () => {
    const many = Array.from({ length: 40 }, (_, i) => `src/mod/file${i}.ts`);
    const picked = selectSourceFiles(many, 4, 28);
    expect(picked.length).toBeLessThanOrEqual(4); // one dir, perDir cap
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
