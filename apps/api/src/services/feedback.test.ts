import { describe, it, expect } from "vitest";
import {
  confidenceDelta,
  applyFeedback,
  feedbackEffect,
  ACCEPT_DELTA,
  DISMISS_DELTA,
  MIN_CONFIDENCE,
  MAX_CONFIDENCE,
} from "@cortex/shared";

describe("feedbackEffect", () => {
  it("maps each feedback state to its confidence effect", () => {
    expect(feedbackEffect("accepted")).toBe(ACCEPT_DELTA);
    expect(feedbackEffect("dismissed")).toBe(DISMISS_DELTA);
    expect(feedbackEffect("pending")).toBe(0);
  });
});

describe("confidenceDelta", () => {
  it("is the difference of effects and is anti-symmetric", () => {
    expect(confidenceDelta("pending", "accepted")).toBeCloseTo(ACCEPT_DELTA, 10);
    expect(confidenceDelta("accepted", "pending")).toBeCloseTo(-ACCEPT_DELTA, 10);
    expect(confidenceDelta("accepted", "dismissed")).toBeCloseTo(DISMISS_DELTA - ACCEPT_DELTA, 10);
  });

  it("treats pending feedback as a no-op (no confidence movement)", () => {
    expect(confidenceDelta("pending", "pending")).toBe(0);
    expect(confidenceDelta("accepted", "accepted")).toBe(0);
    expect(confidenceDelta("dismissed", "dismissed")).toBe(0);
  });
});

describe("applyFeedback", () => {
  it("re-marking is reversible: pending→accepted→dismissed→pending nets to 0 (unclamped)", () => {
    const start = 0.6;
    const afterAccept = applyFeedback(start, "pending", "accepted");
    const afterDismiss = applyFeedback(afterAccept, "accepted", "dismissed");
    const afterPending = applyFeedback(afterDismiss, "dismissed", "pending");
    expect(afterAccept).toBeCloseTo(start + ACCEPT_DELTA, 10);
    expect(afterDismiss).toBeCloseTo(start + DISMISS_DELTA, 10);
    expect(afterPending).toBeCloseTo(start, 10);
  });

  it("undoing a single transition returns to the original confidence", () => {
    const start = 0.5;
    const moved = applyFeedback(start, "pending", "dismissed");
    const back = applyFeedback(moved, "dismissed", "pending");
    expect(back).toBeCloseTo(start, 10);
  });

  it("clamps at the maximum", () => {
    const near = 0.97;
    expect(applyFeedback(near, "pending", "accepted")).toBe(MAX_CONFIDENCE);
  });

  it("clamps at the minimum", () => {
    const near = 0.1;
    // three dismissals would push below MIN; result is clamped, never negative.
    const once = applyFeedback(near, "pending", "dismissed");
    const twice = applyFeedback(once, "pending", "dismissed");
    const thrice = applyFeedback(twice, "pending", "dismissed");
    expect(thrice).toBe(MIN_CONFIDENCE);
    expect(thrice).toBeGreaterThanOrEqual(MIN_CONFIDENCE);
  });

  it("pending→pending leaves confidence untouched", () => {
    expect(applyFeedback(0.42, "pending", "pending")).toBeCloseTo(0.42, 10);
  });
});
