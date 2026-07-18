import { describe, it, expect } from "vitest";
import {
  parseDiffNewLines,
  buildReviewPayload,
  extractMarkers,
  findingKey,
  type Finding,
} from "./github-review.js";

const DIFF = `diff --git a/src/app.ts b/src/app.ts
index 111..222 100644
--- a/src/app.ts
+++ b/src/app.ts
@@ -1,3 +1,4 @@
 const a = 1;
-const b = 2;
+const b = 3;
+const c = 4;
 export { a };
`;

describe("parseDiffNewLines", () => {
  it("collects added and context lines on the new side, skipping deletions", () => {
    const map = parseDiffNewLines(DIFF);
    const lines = map.get("src/app.ts");
    expect(lines).toBeDefined();
    // new file: 1 const a, 2 const b=3 (+), 3 const c=4 (+), 4 export (context)
    expect([...lines!].sort((x, y) => x - y)).toEqual([1, 2, 3, 4]);
  });

  it("ignores files added to /dev/null (deletions)", () => {
    const del = `--- a/gone.ts\n+++ /dev/null\n@@ -1,1 +0,0 @@\n-x\n`;
    expect(parseDiffNewLines(del).size).toBe(0);
  });
});

describe("buildReviewPayload", () => {
  const commentable = parseDiffNewLines(DIFF);
  const findings: Finding[] = [
    { severity: "blocker", title: "Bad b", detail: "fix it", path: "src/app.ts", line: 2 },
    { severity: "nit", title: "No line", detail: "general note" },
    { severity: "warning", title: "Off-diff", detail: "x", path: "src/app.ts", line: 999 },
  ];

  it("places commentable findings inline and folds the rest into the body", () => {
    const p = buildReviewPayload("Summary here", findings, commentable);
    expect(p.comments).toHaveLength(1);
    expect(p.comments[0]).toMatchObject({ path: "src/app.ts", line: 2, side: "RIGHT" });
    expect(p.comments[0]!.body).toContain("memmo-review:");
    // the no-line and off-diff findings go to the body
    expect(p.body).toContain("No line");
    expect(p.body).toContain("Off-diff");
    expect(p.newCount).toBe(3);
  });

  it("drops findings already posted (dedup via markers)", () => {
    const existing = new Set([findingKey(findings[0]!)]);
    const p = buildReviewPayload("Summary", findings, commentable, existing);
    expect(p.comments).toHaveLength(0); // the inline one was already posted
    expect(p.newCount).toBe(2);
  });
});

describe("extractMarkers", () => {
  it("pulls memmo keys out of existing comment bodies", () => {
    const keys = extractMarkers([
      "some text <!-- memmo-review:src/app.ts:2:bad-b -->",
      "no marker here",
    ]);
    expect(keys.has("src/app.ts:2:bad-b")).toBe(true);
    expect(keys.size).toBe(1);
  });
});
