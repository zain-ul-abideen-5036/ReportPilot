import { describe, expect, it } from "vitest";
import {
  formatCompact, formatDuration, formatPct, formatPeriod, formatSignedNumber, formatSignedPct, prettyUrl, urlPath,
} from "../src/format";

describe("formatting", () => {
  it("compacts large numbers but prints small ones in full", () => {
    expect(formatCompact(9_870)).toBe("9,870");
    expect(formatCompact(12_400)).toBe("12.4k");
    expect(formatCompact(250_000)).toBe("250k");
    expect(formatCompact(1_250_000)).toBe("1.25m");
  });

  it("signs percentages with a real minus sign", () => {
    expect(formatSignedPct(0.183)).toBe("+18.3%");
    expect(formatSignedPct(-0.04)).toBe("−4.0%");
    expect(formatSignedPct(0)).toBe("0.0%");
    expect(formatSignedPct(null)).toBe("n/a");
  });

  it("signs absolute changes", () => {
    expect(formatSignedNumber(1.44)).toBe("+1.4");
    expect(formatSignedNumber(-0.6)).toBe("−0.6");
  });

  it("formats fractions as percentages", () => {
    expect(formatPct(0.0342)).toBe("3.4%");
  });

  it("names periods", () => {
    expect(formatPeriod("2026-10")).toBe("October 2026");
  });

  it("describes durations", () => {
    expect(formatDuration("2026-10-01T10:00:00Z", "2026-10-01T10:08:00Z")).toBe("8 min");
    expect(formatDuration("2026-10-01T10:00:00Z", "2026-10-01T11:12:00Z")).toBe("1 h 12 min");
    expect(formatDuration("2026-10-01T10:00:00Z", null)).toBe("ongoing");
  });

  it("tidies URLs for display", () => {
    expect(prettyUrl("https://www.example.com/")).toBe("example.com");
    expect(urlPath("https://example.com/services/seo/?a=1")).toBe("/services/seo/?a=1");
  });
});
