import { describe, it, expect } from "vitest";
import { formatReviewComment } from "./review.js";

describe("formatReviewComment", () => {
  it("renders summary, findings, and the memory attribution", () => {
    const md = formatReviewComment({
      summary: "Looks mostly good.",
      findings: [
        { severity: "blocker", title: "Touches billing", detail: "Add a test.", path: "src/billing.ts", memory: "Billing is risky" },
        { severity: "praise", title: "Nice refactor", detail: "Clean." },
      ],
    });
    expect(md).toContain("Memmo Reviewer");
    expect(md).toContain("Looks mostly good.");
    expect(md).toContain("Blocker");
    expect(md).toContain("`src/billing.ts`");
    expect(md).toContain("memory: Billing is risky");
    expect(md).toContain("Praise");
  });

  it("handles a clean review with no findings", () => {
    const md = formatReviewComment({ summary: "All clear.", findings: [] });
    expect(md).toContain("All clear.");
    expect(md).not.toContain("Blocker");
  });
});
