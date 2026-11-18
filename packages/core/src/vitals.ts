import type { VitalsP75 } from "./types";

/**
 * Core Web Vitals thresholds as published by Google (web.dev/vitals).
 * A metric passes when its 75th percentile is at or under "good".
 */
export const THRESHOLDS = {
  lcp: { good: 2500, poor: 4000 },
  inp: { good: 200, poor: 500 },
  cls: { good: 0.1, poor: 0.25 },
} as const;

export type VitalName = keyof typeof THRESHOLDS;
export type VitalRating = "good" | "needs-improvement" | "poor" | "unknown";

export function rateVital(name: VitalName, value: number | null): VitalRating {
  if (value === null || !Number.isFinite(value)) return "unknown";
  const t = THRESHOLDS[name];
  if (value <= t.good) return "good";
  if (value <= t.poor) return "needs-improvement";
  return "poor";
}

export interface VitalsAssessment {
  ratings: Record<VitalName, VitalRating>;
  /** Google's "passes Core Web Vitals": all three metrics good. */
  passes: boolean | null;
}

export function assessVitals(v: VitalsP75): VitalsAssessment {
  const ratings = {
    lcp: rateVital("lcp", v.lcp),
    inp: rateVital("inp", v.inp),
    cls: rateVital("cls", v.cls),
  };
  const values = Object.values(ratings);
  const passes = values.includes("unknown") ? null : values.every((r) => r === "good");
  return { ratings, passes };
}

/** Relative regression in a vital; positive = got slower or less stable. */
export function vitalRegression(current: number | null, previous: number | null): number | null {
  if (current === null || previous === null || previous === 0) return null;
  return (current - previous) / previous;
}

/** Median of a list, used for the three-run Lighthouse score. */
export function median(values: number[]): number {
  if (values.length === 0) throw new Error("median of an empty list");
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}
