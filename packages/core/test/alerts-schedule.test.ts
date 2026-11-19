import { describe, expect, it } from "vitest";
import { evaluateAlerts, indexingDrop, isoWeek, trafficDrop, vitalsRegression } from "../src/alerts";
import { isDue, localReportingPeriod } from "../src/schedule";

const days = (values: number[]) =>
  values.map((clicks, i) => ({ day: new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10), clicks }));

const empty = { certExpiresAt: null, domainExpiresAt: null, dailyClicks: [], crux: [], index: [] };
const now = new Date("2026-11-10T08:00:00Z");

describe("expiry alerts", () => {
  it("warns at 21 days and goes critical at 7 for SSL", () => {
    const warn = evaluateAlerts({ ...empty, certExpiresAt: "2026-11-25T00:00:00Z" }, now);
    expect(warn).toHaveLength(1);
    expect(warn[0]).toMatchObject({ kind: "ssl", severity: "warning", title: "SSL certificate expires in 14 days" });
    const crit = evaluateAlerts({ ...empty, certExpiresAt: "2026-11-14T00:00:00Z" }, now);
    expect(crit[0]!.severity).toBe("critical");
    expect(crit[0]!.dedupeKey).not.toBe(warn[0]!.dedupeKey);
  });

  it("stays quiet when the certificate has more than 21 days left", () => {
    expect(evaluateAlerts({ ...empty, certExpiresAt: "2027-01-01T00:00:00Z" }, now)).toEqual([]);
  });

  it("uses the domain's own thresholds and reports expired dates", () => {
    const a = evaluateAlerts({ ...empty, domainExpiresAt: "2026-11-05T00:00:00Z" }, now);
    expect(a[0]).toMatchObject({ kind: "domain", severity: "critical" });
    expect(a[0]!.title).toMatch(/expired 5 days ago/);
  });
});

describe("traffic drop", () => {
  it("fires when the last 7 days are 30% or more below the 28 before", () => {
    const a = trafficDrop(days([...Array(28).fill(100), ...Array(7).fill(60)]));
    expect(a).toMatchObject({ kind: "traffic", severity: "warning" });
    expect(a!.title).toContain("−40%");
  });

  it("is critical at a 50% drop", () => {
    expect(trafficDrop(days([...Array(28).fill(100), ...Array(7).fill(40)]))!.severity).toBe("critical");
  });

  it("ignores small dips, short histories and tiny sites", () => {
    expect(trafficDrop(days([...Array(28).fill(100), ...Array(7).fill(80)]))).toBeNull();
    expect(trafficDrop(days(Array(20).fill(100)))).toBeNull();
    expect(trafficDrop(days([...Array(28).fill(10), ...Array(7).fill(1)]))).toBeNull();
  });

  it("dedupes by the ISO week of the latest day", () => {
    expect(isoWeek("2026-11-04")).toBe("2026-W45");
    expect(isoWeek("2027-01-01")).toBe("2026-W53");
  });
});

describe("vitals regression", () => {
  const week = (i: number, lcp: number, inp = 150) => ({ week: `2026-10-${String(i + 1).padStart(2, "0")}`, lcp, inp, cls: 0.05 });

  it("fires when a metric worsens 20% and crosses the good line", () => {
    const a = vitalsRegression([week(0, 2200), week(1, 2300), week(2, 2400), week(3, 2500), week(4, 2900)]);
    expect(a).toMatchObject({ kind: "vitals", severity: "warning" });
    expect(a!.title).toMatch(/^LCP regressed \+32%/);
  });

  it("does not fire for a regression that stays within good", () => {
    expect(vitalsRegression([week(0, 1000), week(1, 1000), week(2, 1000), week(3, 1000), week(4, 1500)])).toBeNull();
  });

  it("is critical when the metric becomes poor", () => {
    const a = vitalsRegression([week(0, 2000, 300), week(1, 0, 300), week(2, 0, 300), week(3, 0, 300), week(4, 2000, 600)]);
    expect(a).toMatchObject({ severity: "critical" });
    expect(a!.title).toMatch(/^INP/);
  });
});

describe("indexing", () => {
  it("names a single page that dropped out", () => {
    const a = indexingDrop([
      { url: "https://example.com/services/", verdict: "FAIL", coverageState: "Crawled - currently not indexed", lastCrawl: null },
      { url: "https://example.com/", verdict: "PASS", coverageState: "Submitted and indexed", lastCrawl: null },
    ]);
    expect(a!.title).toBe("/services/ is not in Google's index");
  });
});

describe("per-client schedule", () => {
  const london = { timezone: "Europe/London", reportDay: 3 };
  const sydney = { timezone: "Australia/Sydney", reportDay: 3 };

  it("is due from 06:00 local time on the report day", () => {
    expect(isDue("2026-10", london, new Date("2026-11-03T05:59:00Z"))).toBe(false);
    expect(isDue("2026-10", london, new Date("2026-11-03T06:00:00Z"))).toBe(true);
  });

  it("is due in Sydney the evening before London", () => {
    // 06:00 on the 3rd in Sydney (UTC+11 in November) is 19:00 UTC on the 2nd.
    expect(isDue("2026-10", sydney, new Date("2026-11-02T19:00:00Z"))).toBe(true);
    expect(isDue("2026-10", london, new Date("2026-11-02T19:00:00Z"))).toBe(false);
  });

  it("stays due after the day so missed runs catch up, and is never due early", () => {
    expect(isDue("2026-10", london, new Date("2026-11-20T12:00:00Z"))).toBe(true);
    expect(isDue("2026-10", london, new Date("2026-10-30T12:00:00Z"))).toBe(false);
  });

  it("clamps report days to the allowed window", () => {
    expect(isDue("2026-10", { timezone: "UTC", reportDay: 1 }, new Date("2026-11-01T12:00:00Z"))).toBe(false);
  });

  it("works out the reporting month from the local calendar", () => {
    expect(localReportingPeriod(new Date("2026-11-30T14:00:00Z"), "Pacific/Auckland")).toBe("2026-11");
    expect(localReportingPeriod(new Date("2026-11-30T14:00:00Z"), "Europe/London")).toBe("2026-10");
  });
});
