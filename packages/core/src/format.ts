/**
 * Formatting used by the PDF, the email and the dashboard, so a figure
 * reads identically wherever a client sees it.
 */

const LOCALE = "en-GB";

export function formatInt(value: number): string {
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(Math.round(value));
}

/** 12,400 → "12.4k", 1,250,000 → "1.25m". Below 10,000 prints in full. */
export function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs < 10_000) return formatInt(value);
  if (abs < 1_000_000) return `${trim(value / 1000, abs < 100_000 ? 1 : 0)}k`;
  return `${trim(value / 1_000_000, 2)}m`;
}

function trim(value: number, decimals: number): string {
  return value.toFixed(decimals).replace(/\.0+$/, "").replace(/(\.\d*?)0+$/, "$1");
}

/** 0.0342 → "3.4%". */
export function formatPct(fraction: number, decimals = 1): string {
  return `${(fraction * 100).toFixed(decimals)}%`;
}

/** Signed relative change: 0.183 → "+18.3%", -0.04 → "−4.0%". */
export function formatSignedPct(fraction: number | null, decimals = 1): string {
  if (fraction === null || !Number.isFinite(fraction)) return "n/a";
  const value = (fraction * 100).toFixed(decimals);
  if (Number(value) === 0) return `0.${"0".repeat(decimals)}%`;
  return fraction > 0 ? `+${value}%` : `−${value.replace("-", "")}%`;
}

/** Signed absolute change: 1.4 → "+1.4", -0.6 → "−0.6". */
export function formatSignedNumber(value: number | null, decimals = 1): string {
  if (value === null || !Number.isFinite(value)) return "n/a";
  const s = Math.abs(value).toFixed(decimals);
  if (Number(s) === 0) return s;
  return value > 0 ? `+${s}` : `−${s}`;
}

export function formatPosition(value: number): string {
  return value.toFixed(1);
}

/** Milliseconds as seconds for LCP-style figures: 2480 → "2.5 s". */
export function formatSeconds(ms: number | null): string {
  if (ms === null) return "n/a";
  return `${(ms / 1000).toFixed(1)} s`;
}

export function formatMs(ms: number | null): string {
  if (ms === null) return "n/a";
  return `${formatInt(ms)} ms`;
}

export function formatCls(value: number | null): string {
  if (value === null) return "n/a";
  return value.toFixed(2);
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "2026-10" → "October 2026". */
export function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return `${MONTHS[(m ?? 1) - 1]} ${y}`;
}

/** "2026-10" → "Oct". */
export function formatPeriodShort(period: string): string {
  const m = Number(period.split("-")[1]);
  return (MONTHS[m - 1] ?? "").slice(0, 3);
}

/** "2026-10-31" → "31 Oct". */
export function formatDayShort(day: string): string {
  const [, m, d] = day.split("-").map(Number);
  return `${d} ${(MONTHS[(m ?? 1) - 1] ?? "").slice(0, 3)}`;
}

/** Duration between two timestamps in human units: "1 h 12 min", "8 min". */
export function formatDuration(fromIso: string, toIso: string | null): string {
  if (!toIso) return "ongoing";
  const minutes = Math.max(0, Math.round((Date.parse(toIso) - Date.parse(fromIso)) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

/** Strip protocol and trailing slash for display: https://a.com/b/ → a.com/b */
export function prettyUrl(url: string): string {
  return url.replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
}

/** Path part only, for page tables: https://a.com/services/seo/ → /services/seo/ */
export function urlPath(url: string): string {
  try {
    const u = new URL(url);
    return u.pathname + u.search;
  } catch {
    return url;
  }
}
