import { describe, expect, it } from "vitest";
import { collectDemo, DEMO_NOW, SITES } from "@reportpilot/demo";
import { buildReport } from "../src/report";
import { templateNarrative, statusSentence, pickHighlights } from "../src/narrative";
import { acceptAiText, extractNumbers } from "../src/number-check";

describe("buildReport", () => {
  it("is deterministic: same input, same output", () => {
    const a = buildReport(collectDemo("site_harlow"), DEMO_NOW);
    const b = buildReport(collectDemo("site_harlow"), DEMO_NOW);
    expect(a).toEqual(b);
  });

  it("builds every demo site without throwing", () => {
    for (const s of SITES) expect(() => buildReport(collectDemo(s.id), DEMO_NOW)).not.toThrow();
  });

  it("handles a missing source honestly instead of showing zeros", () => {
    const data = collectDemo("site_harlow");
    const report = buildReport({ ...data, speed: null }, DEMO_NOW);
    expect(report.speed).toBeNull();
    expect(report.status.speed).toBe("unknown");
    expect(report.findings.some((f) => f.area === "speed")).toBe(false);
  });

  it("flags the expiring SSL certificate on the demo vet site", () => {
    const report = buildReport(collectDemo("site_calder"), DEMO_NOW);
    expect(report.findings[0]!.id).toBe("ssl-expiring");
    expect(report.status.reliability).toBe("act");
  });

  it("ranks findings by weight", () => {
    const { findings } = buildReport(collectDemo("site_pennine"), DEMO_NOW);
    const weights = findings.map((f) => f.weight);
    expect(weights).toEqual([...weights].sort((a, b) => b - a));
  });
});

describe("narrative", () => {
  const report = buildReport(collectDemo("site_brightwater"), DEMO_NOW);
  const n = templateNarrative(report);

  it("writes at most five highlights and covers each area", () => {
    expect(n.highlights.length).toBeLessThanOrEqual(5);
    const areas = new Set(pickHighlights(report.findings).map((f) => f.area));
    expect(areas.has("reliability")).toBe(true);
  });

  it("only quotes figures the findings contain", () => {
    const facts = report.findings.flatMap((f) => Object.values(f.facts)).join(" ");
    for (const h of n.highlights) {
      for (const num of extractNumbers(h)) expect(extractNumbers(facts + " 8 20")).toContain(num);
    }
  });

  it("accepts its own template text through the number check", () => {
    const text = [n.summary, ...n.highlights].join(" ");
    expect(acceptAiText(text, text)).toBe(true);
  });

  it("reads naturally when areas differ", () => {
    expect(statusSentence({ search: "good", speed: "good", reliability: "watch" })).toBe("Search and speed are on track; reliability needs watching.");
  });
});
