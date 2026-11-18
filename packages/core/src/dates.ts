/**
 * Period arithmetic. Periods are calendar months as `YYYY-MM` strings;
 * we never use Date objects for months because time zones would shift
 * the boundaries.
 */

export function toPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parsePeriod(period: string): { year: number; month: number } {
  const match = /^(\d{4})-(\d{2})$/.exec(period);
  if (!match) throw new Error(`Invalid period "${period}", expected YYYY-MM`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (month < 1 || month > 12) throw new Error(`Invalid month in period "${period}"`);
  return { year, month };
}

export function addMonths(period: string, delta: number): string {
  const { year, month } = parsePeriod(period);
  const index = year * 12 + (month - 1) + delta;
  return toPeriod(Math.floor(index / 12), (index % 12) + 1);
}

export const previousPeriod = (p: string) => addMonths(p, -1);
export const yearAgoPeriod = (p: string) => addMonths(p, -12);

export function daysInPeriod(period: string): number {
  const { year, month } = parsePeriod(period);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** First and last calendar day, as YYYY-MM-DD, for API date ranges. */
export function periodRange(period: string): { startDate: string; endDate: string } {
  const days = daysInPeriod(period);
  return { startDate: `${period}-01`, endDate: `${period}-${String(days).padStart(2, "0")}` };
}

/** All days in the period, as YYYY-MM-DD. */
export function periodDays(period: string): string[] {
  const n = daysInPeriod(period);
  return Array.from({ length: n }, (_, i) => `${period}-${String(i + 1).padStart(2, "0")}`);
}

/** The month that a report run on `now` should cover: the previous calendar month. */
export function reportingPeriodFor(now: Date): string {
  return previousPeriod(toPeriod(now.getUTCFullYear(), now.getUTCMonth() + 1));
}

/** The trailing N periods ending at (and including) `period`, oldest first. */
export function trailingPeriods(period: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addMonths(period, i - count + 1));
}

/** Whole days from `fromIso` until `toIso`; negative when already past. */
export function daysUntil(toIso: string, from: Date = new Date()): number {
  return Math.floor((Date.parse(toIso) - from.getTime()) / 86_400_000);
}
