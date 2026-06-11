import { describe, it, expect, vi } from "vitest";
import { rateLimit } from "./rate-limit.js";

function mockReply() {
  const r = {
    statusCode: 0 as number,
    body: null as unknown,
    header: vi.fn(() => r),
    code: vi.fn((c: number) => {
      r.statusCode = c;
      return r;
    }),
    send: vi.fn((b: unknown) => {
      r.body = b;
      return r;
    }),
  };
  return r;
}

describe("rateLimit", () => {
  it("allows up to max, then returns 429", async () => {
    const limiter = rateLimit({ max: 2, windowMs: 10_000, key: "test-a" });
    const req = { ip: "10.0.0.1" } as never;

    const r1 = mockReply();
    await limiter(req, r1 as never);
    expect(r1.statusCode).toBe(0);

    const r2 = mockReply();
    await limiter(req, r2 as never);
    expect(r2.statusCode).toBe(0);

    const r3 = mockReply();
    await limiter(req, r3 as never);
    expect(r3.statusCode).toBe(429);
  });

  it("tracks IPs independently", async () => {
    const limiter = rateLimit({ max: 1, windowMs: 10_000, key: "test-b" });
    const a = mockReply();
    await limiter({ ip: "1.1.1.1" } as never, a as never);
    const b = mockReply();
    await limiter({ ip: "2.2.2.2" } as never, b as never);
    expect(a.statusCode).toBe(0);
    expect(b.statusCode).toBe(0);
  });
});
