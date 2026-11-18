/**
 * Minimal scale and path helpers. The charts are hand-rolled SVG so they
 * render on the server, print crisply in the PDF and ship no runtime JS.
 */

export function linear(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (v: number) => r0 + ((v - d0) / span) * (r1 - r0);
}

/** "Nice" axis maximum and step: 0–1,840 becomes 0–2,000 in steps of 500. */
export function niceTicks(max: number, count = 4): { max: number; step: number; ticks: number[] } {
  if (max <= 0) return { max: 1, step: 1, ticks: [0, 1] };
  const raw = max / count;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const residual = raw / magnitude;
  const nice = residual > 5 ? 10 : residual > 2.5 ? 5 : residual > 2 ? 2.5 : residual > 1 ? 2 : 1;
  const step = nice * magnitude;
  const top = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let t = 0; t <= top + step / 2; t += step) ticks.push(+t.toFixed(10));
  return { max: top, step, ticks };
}

export type Point = [number, number];

export function linePath(points: Point[]): string {
  return points.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`).join("");
}

/**
 * Monotone cubic interpolation (Fritsch–Carlson). Smooth like a spline,
 * but never overshoots, so a dip in the data is never drawn below zero.
 */
export function smoothPath(points: Point[]): string {
  const n = points.length;
  if (n < 3) return linePath(points);
  const dx: number[] = [];
  const slope: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    const h = points[i + 1]![0] - points[i]![0];
    dx.push(h);
    slope.push((points[i + 1]![1] - points[i]![1]) / (h || 1));
  }
  const tangent: number[] = [slope[0]!];
  for (let i = 1; i < n - 1; i++) {
    const a = slope[i - 1]!;
    const b = slope[i]!;
    tangent.push(a * b <= 0 ? 0 : (3 * (dx[i - 1]! + dx[i]!)) / ((2 * dx[i]! + dx[i - 1]!) / a + (dx[i]! + 2 * dx[i - 1]!) / b));
  }
  tangent.push(slope[n - 2]!);
  let d = `M${points[0]![0].toFixed(2)},${points[0]![1].toFixed(2)}`;
  for (let i = 0; i < n - 1; i++) {
    const [x0, y0] = points[i]!;
    const [x1, y1] = points[i + 1]!;
    const h = dx[i]! / 3;
    d += `C${(x0 + h).toFixed(2)},${(y0 + tangent[i]! * h).toFixed(2)} ${(x1 - h).toFixed(2)},${(y1 - tangent[i + 1]! * h).toFixed(2)} ${x1.toFixed(2)},${y1.toFixed(2)}`;
  }
  return d;
}

/** Close a line path down to a baseline to make an area. */
export function areaPath(line: string, points: Point[], baseline: number): string {
  if (points.length === 0) return "";
  const first = points[0]!;
  const last = points[points.length - 1]!;
  return `${line}L${last[0].toFixed(2)},${baseline}L${first[0].toFixed(2)},${baseline}Z`;
}

export function compactTick(v: number): string {
  if (v >= 1_000_000) return `${+(v / 1_000_000).toFixed(1)}m`;
  if (v >= 1000) return `${+(v / 1000).toFixed(1)}k`;
  return String(Math.round(v * 100) / 100);
}
