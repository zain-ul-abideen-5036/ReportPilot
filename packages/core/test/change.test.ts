import { describe, expect, it } from "vitest";
import { change, isImprovement, pctChange, round, trendOf } from "../src/change";

describe("pctChange", () => {
  it("matches the spec example: 1,000 → 1,200 clicks is +20.0%", () => {
    expect(round(pctChange(1200, 1000)! * 100, 1)).toBe(20);
  });

  it("handles declines", () => {
    expect(pctChange(750, 1000)).toBeCloseTo(-0.25);
  });

  it("returns null when there is nothing to compare against", () => {
    expect(pctChange(100, 0)).toBeNull();
    expect(pctChange(100, null)).toBeNull();
    expect(pctChange(100, undefined)).toBeNull();
  });
});

describe("change", () => {
  it("carries current, previous, delta and pct", () => {
    expect(change(12.4, 14)).toEqual({ current: 12.4, previous: 14, delta: 12.4 - 14, pct: (12.4 - 14) / 14 });
  });

  it("leaves delta null without a previous value", () => {
    expect(change(5, null).delta).toBeNull();
  });
});

describe("direction", () => {
  it("treats a falling average position as an improvement", () => {
    const c = change(6.4, 8.1);
    expect(trendOf(c)).toBe("down");
    expect(isImprovement(c, "lower-is-better")).toBe(true);
    expect(isImprovement(c, "higher-is-better")).toBe(false);
  });

  it("calls changes under 2% flat", () => {
    expect(trendOf(change(1010, 1000))).toBe("flat");
    expect(isImprovement(change(1010, 1000), "higher-is-better")).toBeNull();
  });
});

describe("round", () => {
  it("avoids floating point drift", () => {
    expect(round(1.005, 2)).toBe(1.01);
  });
});
