import { describe, it, expect } from "vitest";
import { relevantToFiles } from "./relevance.js";

const mem = (paths: string[], title = "t", content = "c") => ({ title, content, paths });

describe("relevantToFiles", () => {
  it("matches glob patterns precisely", () => {
    const m = [mem(["src/billing/**"])];
    expect(relevantToFiles(m, ["src/billing/webhooks.ts"])).toHaveLength(1);
    expect(relevantToFiles(m, ["src/auth/login.ts"])).toHaveLength(0);
  });

  it("treats plain patterns as substrings", () => {
    const m = [mem(["webhook"])];
    expect(relevantToFiles(m, ["src/billing/webhooks.ts"])).toHaveLength(1);
    expect(relevantToFiles(m, ["src/ui/button.tsx"])).toHaveLength(0);
  });

  it("falls back to content tokens when a memory has no paths", () => {
    const m = [mem([], "Billing rules", "do not touch invoices")];
    expect(relevantToFiles(m, ["src/billing/charge.ts"])).toHaveLength(1);
    expect(relevantToFiles(m, ["src/auth/login.ts"])).toHaveLength(0);
  });

  it("handles ** across directories", () => {
    const m = [mem(["**/webhooks.ts"])];
    expect(relevantToFiles(m, ["a/b/c/webhooks.ts"])).toHaveLength(1);
  });
});
