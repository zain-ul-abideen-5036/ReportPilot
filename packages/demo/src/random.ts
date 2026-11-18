/**
 * Seeded randomness so the demo agency looks identical on every machine,
 * in every screenshot and in every visual regression snapshot.
 */

export type Rng = () => number;

/** mulberry32: small, fast, good enough for fake analytics. */
export function createRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Stable 32-bit hash of a string, for per-site seeds. */
export function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const between = (rng: Rng, min: number, max: number) => min + rng() * (max - min);
export const intBetween = (rng: Rng, min: number, max: number) => Math.floor(between(rng, min, max + 1));
export const pick = <T>(rng: Rng, items: readonly T[]): T => items[Math.floor(rng() * items.length)]!;

/** Roughly normal noise around 1, for multiplying daily values. */
export function wobble(rng: Rng, spread = 0.12): number {
  const u = (rng() + rng() + rng()) / 3; // Irwin–Hall approximation
  return 1 + (u - 0.5) * 2 * spread;
}
