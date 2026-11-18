import { describe, expect, it } from "vitest";
import { acceptAiText, checkNumbers, extractNumbers, normaliseNumber } from "../src/number-check";

const SOURCE = "Organic clicks rose to 12,400, +18.3% on last month and +42.0% on last year. The site was up 99.98% of the month.";

describe("number check", () => {
  it("normalises formatting differences", () => {
    expect(normaliseNumber("12,400")).toBe("12400");
    expect(normaliseNumber("+18.3")).toBe("18.3");
    expect(normaliseNumber("−4.0")).toBe("4");
  });

  it("extracts every figure", () => {
    expect(extractNumbers(SOURCE)).toEqual(["12400", "18.3", "42", "99.98"]);
  });

  it("accepts a rewrite that reuses the source figures", () => {
    const ai = "Clicks from Google climbed 18.3% to 12,400 this month, 42.0% ahead of last year, and the site stayed up 99.98% of the time.";
    expect(checkNumbers(ai, SOURCE)).toEqual({ ok: true, unexpected: [] });
    expect(acceptAiText(ai, SOURCE)).toBe(true);
  });

  it("rejects a rewrite that invents or rounds a figure", () => {
    const ai = "Clicks climbed about 18% to 12,400, and the site stayed up 99.98% of the time, 42% ahead of last year.";
    const result = checkNumbers(ai, SOURCE);
    expect(result.ok).toBe(false);
    expect(result.unexpected).toEqual(["18"]);
    expect(acceptAiText(ai, SOURCE)).toBe(false);
  });

  it("rejects empty output and summaries that drop most figures", () => {
    expect(acceptAiText("", SOURCE)).toBe(false);
    expect(acceptAiText("A good month overall, with growth in search traffic and solid reliability.", SOURCE)).toBe(false);
  });
});
