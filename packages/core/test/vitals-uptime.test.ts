import { describe, expect, it } from "vitest";
import { assessVitals, median, rateVital, vitalRegression } from "../src/vitals";
import { nextMonitorState, p95, rollupDay, summariseUptime } from "../src/uptime";

describe("Core Web Vitals", () => {
  it("rates against Google's thresholds, inclusive of the boundary", () => {
    expect(rateVital("lcp", 2500)).toBe("good");
    expect(rateVital("lcp", 2501)).toBe("needs-improvement");
    expect(rateVital("inp", 501)).toBe("poor");
    expect(rateVital("cls", null)).toBe("unknown");
  });

  it("passes only when all three are good", () => {
    expect(assessVitals({ lcp: 2000, inp: 150, cls: 0.05 }).passes).toBe(true);
    expect(assessVitals({ lcp: 2000, inp: 250, cls: 0.05 }).passes).toBe(false);
    expect(assessVitals({ lcp: 2000, inp: null, cls: 0.05 }).passes).toBeNull();
  });

  it("measures regression as relative change", () => {
    expect(vitalRegression(280, 200)).toBeCloseTo(0.4);
    expect(vitalRegression(null, 200)).toBeNull();
  });

  it("takes the median of three lab runs", () => {
    expect(median([62, 91, 70])).toBe(70);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
});

describe("uptime", () => {
  it("only marks a site down after the re-check also fails", () => {
    expect(nextMonitorState("up", false, null)).toBe("up");
    expect(nextMonitorState("up", false, true)).toBe("up");
    expect(nextMonitorState("up", false, false)).toBe("down");
    expect(nextMonitorState("down", true, null)).toBe("up");
  });

  it("computes p95 by nearest rank", () => {
    const values = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(p95(values)).toBe(95);
  });

  it("rolls a day of checks into uptime and response times", () => {
    const checks = [...Array(286).fill({ ok: true, ms: 300 }), { ok: false, ms: 0 }, { ok: false, ms: 0 }];
    const day = rollupDay("2026-10-01", checks);
    expect(day.uptimePct).toBeCloseTo((286 / 288) * 100);
    expect(day.avgMs).toBe(300);
  });

  it("summarises incidents and expiry countdowns", () => {
    const now = new Date("2026-11-01T00:00:00Z");
    const s = summariseUptime({
      days: [{ day: "2026-10-01", uptimePct: 99, avgMs: 300, p95Ms: 600 }, { day: "2026-10-02", uptimePct: 100, avgMs: 500, p95Ms: 900 }],
      incidents: [{ id: "i", startedAt: "2026-10-01T10:00:00Z", resolvedAt: "2026-10-01T10:14:00Z", cause: "503" }],
      certExpiresAt: "2026-11-11T00:00:00Z",
      domainExpiresAt: null,
    }, now);
    expect(s.uptimePct).toBe(99.5);
    expect(s.avgMs).toBe(400);
    expect(s.p95Ms).toBe(900);
    expect(s.downtimeMinutes).toBe(14);
    expect(s.certDaysLeft).toBe(10);
    expect(s.domainDaysLeft).toBeNull();
  });
});
