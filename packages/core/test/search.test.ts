import { describe, expect, it } from "vitest";
import { brandedSplit, expectedCtr, lowCtrPages, movers, strikingDistance, sumTotals, topTenMovement } from "../src/search";
import type { PageRow, QueryRow } from "../src/types";

const q = (query: string, clicks: number, impressions: number, position: number): QueryRow => ({
  query, clicks, impressions, position, ctr: impressions ? clicks / impressions : 0,
});

describe("strikingDistance", () => {
  const queries = [
    q("dentist leeds", 40, 3000, 11.2),
    q("invisalign leeds", 20, 900, 8.4),
    q("teeth whitening", 2, 60, 12),     // too few impressions
    q("harlow finch", 500, 900, 1.1),    // already page one
    q("emergency dentist", 5, 1500, 23), // beyond 20
  ];

  it("keeps positions 8–20 with real demand, biggest audience first", () => {
    expect(strikingDistance(queries).map((r) => r.query)).toEqual(["dentist leeds", "invisalign leeds"]);
  });

  it("respects custom bounds", () => {
    expect(strikingDistance(queries, { maxPosition: 25 }).map((r) => r.query)).toContain("emergency dentist");
  });
});

describe("expectedCtr", () => {
  it("falls with position", () => {
    expect(expectedCtr(1)).toBeGreaterThan(expectedCtr(3));
    expect(expectedCtr(10)).toBeGreaterThan(expectedCtr(15));
  });
});

describe("lowCtrPages", () => {
  const page = (p: string, clicks: number, impressions: number, position: number): PageRow => ({
    page: p, clicks, impressions, position, ctr: clicks / impressions,
  });

  it("flags pages under half the CTR their position usually earns", () => {
    const pages = [page("/a", 10, 5000, 3), page("/b", 500, 5000, 3), page("/c", 1, 100, 3)];
    const result = lowCtrPages(pages);
    expect(result.map((p) => p.page)).toEqual(["/a"]);
    expect(result[0]!.missedClicks).toBe(Math.round(5000 * expectedCtr(3) - 10));
  });
});

describe("movers", () => {
  it("counts pages missing from one month as zero", () => {
    const now = [{ k: "/new", clicks: 50 }, { k: "/same", clicks: 10 }];
    const before = [{ k: "/gone", clicks: 40 }, { k: "/same", clicks: 10 }];
    const { gainers, losers } = movers(now, before, (r) => r.k);
    expect(gainers).toEqual([{ key: "/new", current: 50, previous: 0, delta: 50 }]);
    expect(losers).toEqual([{ key: "/gone", current: 0, previous: 40, delta: -40 }]);
  });
});

describe("topTenMovement", () => {
  it("finds queries that crossed position 10 in either direction", () => {
    const prev = [q("a", 1, 100, 12), q("b", 1, 100, 6)];
    const curr = [q("a", 5, 100, 9), q("b", 0, 100, 14)];
    const m = topTenMovement(curr, prev);
    expect(m.entered.map((x) => x.query)).toEqual(["a"]);
    expect(m.dropped.map((x) => x.query)).toEqual(["b"]);
    expect(m.dropped[0]!.previousPosition).toBe(6);
  });
});

describe("brandedSplit", () => {
  const queries = [q("harlow finch dental", 300, 600, 1), q("dentist leeds", 100, 3000, 9)];

  it("splits by a case-insensitive brand pattern", () => {
    const split = brandedSplit(queries, "Harlow|finch")!;
    expect(split.branded.clicks).toBe(300);
    expect(split.nonBranded.clicks).toBe(100);
    expect(split.nonBrandedShare).toBeCloseTo(0.25);
  });

  it("returns null for a missing or invalid pattern", () => {
    expect(brandedSplit(queries, null)).toBeNull();
    expect(brandedSplit(queries, "(")).toBeNull();
  });
});

describe("sumTotals", () => {
  it("weights position by impressions", () => {
    const t = sumTotals([q("a", 10, 100, 2), q("b", 10, 300, 10)]);
    expect(t.position).toBe(8);
    expect(t.ctr).toBeCloseTo(20 / 400);
  });
});
