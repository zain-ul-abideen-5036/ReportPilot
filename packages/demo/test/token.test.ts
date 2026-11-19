import { describe, expect, it } from "vitest";
import { shareTokenFor } from "../src/token";
import { SITES } from "../src/agency";

describe("sample share tokens", () => {
  it("always look like a real 128-bit token, whatever the salt", () => {
    for (let i = 0; i < 5000; i++) {
      expect(shareTokenFor(`site_${i % 9}`, "2026-10", String(1_763_500_000_000 + i * 7919))).toMatch(/^[0-9a-f]{32}$/);
    }
  });

  it("are stable for a site and month, and differ between sites and salts", () => {
    const a = shareTokenFor("site_harlow", "2026-10");
    expect(shareTokenFor("site_harlow", "2026-10")).toBe(a);
    expect(shareTokenFor("site_pennine", "2026-10")).not.toBe(a);
    expect(shareTokenFor("site_harlow", "2026-10", "1")).not.toBe(a);
    expect(new Set(SITES.map((s) => shareTokenFor(s.id, "2026-10"))).size).toBe(SITES.length);
  });
});
