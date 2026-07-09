import { describe, it, expect } from "vitest";
import {
  classifyStaleness,
  findConflicts,
  memoryHealth,
  type HealthMemory,
} from "./memoryHealth.js";

const NOW = new Date("2026-07-09T00:00:00Z");
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000);

function mem(p: Partial<HealthMemory> & { id: string; title: string }): HealthMemory {
  return {
    id: p.id,
    type: p.type ?? "risk",
    title: p.title,
    content: p.content ?? "",
    paths: p.paths ?? [],
    status: p.status ?? "approved",
    updatedAt: p.updatedAt ?? NOW,
    lastUsedAt: p.lastUsedAt ?? null,
  };
}

describe("classifyStaleness", () => {
  it("buckets by age since last use/update", () => {
    expect(classifyStaleness(mem({ id: "1", title: "x", updatedAt: daysAgo(10) }), NOW)).toBe("fresh");
    expect(classifyStaleness(mem({ id: "2", title: "x", updatedAt: daysAgo(100) }), NOW)).toBe("aging");
    expect(classifyStaleness(mem({ id: "3", title: "x", updatedAt: daysAgo(300) }), NOW)).toBe("stale");
  });

  it("counts recent use as fresh even when the row is old", () => {
    const m = mem({ id: "1", title: "x", updatedAt: daysAgo(300), lastUsedAt: daysAgo(5) });
    expect(classifyStaleness(m, NOW)).toBe("fresh");
  });
});

describe("findConflicts", () => {
  it("flags identical content as a duplicate", () => {
    const a = mem({ id: "a", title: "Run migrations locally", content: "use pnpm db:migrate" });
    const b = mem({ id: "b", title: "Run migrations", content: "use pnpm db:migrate", type: "risk" });
    const [c] = findConflicts([a, b]);
    expect(c?.kind).toBe("duplicate");
    expect([c?.a.id, c?.b.id].sort()).toEqual(["a", "b"]);
  });

  it("flags same-subject, differing content as divergent (a contradiction)", () => {
    const a = mem({ id: "a", title: "Package manager", content: "always use pnpm", type: "project_rule" });
    const b = mem({ id: "b", title: "Package manager", content: "always use npm", type: "project_rule" });
    const [c] = findConflicts([a, b]);
    expect(c?.kind).toBe("divergent");
  });

  it("does not flag memories of different types", () => {
    const a = mem({ id: "a", title: "Stripe webhooks", type: "risk" });
    const b = mem({ id: "b", title: "Stripe webhooks", type: "command" });
    expect(findConflicts([a, b])).toHaveLength(0);
  });

  it("does not flag unrelated titles", () => {
    const a = mem({ id: "a", title: "Stripe webhook idempotency" });
    const b = mem({ id: "b", title: "Redis cache eviction policy" });
    expect(findConflicts([a, b])).toHaveLength(0);
  });

  it("ignores non-approved memories", () => {
    const a = mem({ id: "a", title: "same thing", content: "x" });
    const b = mem({ id: "b", title: "same thing", content: "y", status: "proposed" });
    expect(findConflicts([a, b])).toHaveLength(0);
  });
});

describe("memoryHealth", () => {
  it("summarizes staleness buckets and conflicts over approved memories only", () => {
    const report = memoryHealth(
      [
        mem({ id: "fresh", title: "fresh one", updatedAt: daysAgo(1) }),
        mem({ id: "old1", title: "duplicate subject", content: "same", updatedAt: daysAgo(300) }),
        mem({ id: "old2", title: "duplicate subject", content: "same", updatedAt: daysAgo(300) }),
        mem({ id: "prop", title: "ignored", status: "proposed", updatedAt: daysAgo(400) }),
      ],
      NOW,
    );
    expect(report.approvedCount).toBe(3);
    expect(report.fresh).toBe(1);
    expect(report.stale).toBe(2);
    expect(report.staleMemories[0]!.ageDays).toBe(300);
    expect(report.conflicts).toHaveLength(1);
    expect(report.conflicts[0]!.kind).toBe("duplicate");
  });
});
