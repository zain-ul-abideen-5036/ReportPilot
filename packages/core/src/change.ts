/**
 * Change calculations. These are the numbers clients quote back to us,
 * so they are deliberately boring: one definition, used everywhere.
 */

export interface Change {
  current: number;
  previous: number | null;
  /** Absolute difference, current - previous. */
  delta: number | null;
  /** Relative change as a fraction, 0.2 = +20%. Null when undefined. */
  pct: number | null;
}

/** Round to a fixed number of decimals without floating-point drift. */
export function round(value: number, decimals = 1): number {
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/**
 * Relative change between two values.
 * Returns null when the previous value is missing or zero, because
 * "up infinity percent" is not a figure anyone can act on.
 */
export function pctChange(current: number, previous: number | null | undefined): number | null {
  if (previous === null || previous === undefined || previous === 0) return null;
  return (current - previous) / Math.abs(previous);
}

export function change(current: number, previous: number | null | undefined): Change {
  const prev = previous ?? null;
  return {
    current,
    previous: prev,
    delta: prev === null ? null : current - prev,
    pct: pctChange(current, prev),
  };
}

/**
 * For metrics where lower is better (average position, LCP), a negative
 * delta is an improvement. This normalises direction so the UI can colour
 * changes without knowing the metric.
 */
export type Direction = "higher-is-better" | "lower-is-better";

export type Trend = "up" | "down" | "flat";

export function trendOf(c: Change, threshold = 0.02): Trend {
  if (c.pct === null) {
    if (c.delta === null || c.delta === 0) return "flat";
    return c.delta > 0 ? "up" : "down";
  }
  if (Math.abs(c.pct) < threshold) return "flat";
  return c.pct > 0 ? "up" : "down";
}

export function isImprovement(c: Change, direction: Direction, threshold = 0.02): boolean | null {
  const t = trendOf(c, threshold);
  if (t === "flat") return null;
  return direction === "higher-is-better" ? t === "up" : t === "down";
}
