import { describe, expect, it } from "vitest";
import { addMonths, daysInPeriod, parsePeriod, periodRange, reportingPeriodFor, trailingPeriods } from "../src/dates";

describe("periods", () => {
  it("adds months across year boundaries", () => {
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(addMonths("2025-12", 1)).toBe("2026-01");
    expect(addMonths("2026-10", -12)).toBe("2025-10");
  });

  it("knows month lengths, including leap years", () => {
    expect(daysInPeriod("2028-02")).toBe(29);
    expect(daysInPeriod("2026-02")).toBe(28);
    expect(daysInPeriod("2026-10")).toBe(31);
  });

  it("produces API date ranges", () => {
    expect(periodRange("2026-09")).toEqual({ startDate: "2026-09-01", endDate: "2026-09-30" });
  });

  it("reports on the previous month", () => {
    expect(reportingPeriodFor(new Date("2026-11-03T06:00:00Z"))).toBe("2026-10");
    expect(reportingPeriodFor(new Date("2027-01-03T06:00:00Z"))).toBe("2026-12");
  });

  it("lists trailing periods oldest first", () => {
    const t = trailingPeriods("2026-10", 13);
    expect(t).toHaveLength(13);
    expect(t[0]).toBe("2025-10");
    expect(t.at(-1)).toBe("2026-10");
  });

  it("rejects malformed periods", () => {
    expect(() => parsePeriod("2026-13")).toThrow();
    expect(() => parsePeriod("Oct 2026")).toThrow();
  });
});
