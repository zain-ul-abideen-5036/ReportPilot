import { addMonths, parsePeriod, toPeriod } from "./dates";

/**
 * Per-client scheduling. Each client receives the report for month P on
 * their chosen report day of month P+1, at 06:00 in their own time zone.
 * The workflow runs hourly over the reporting window and the plan step
 * asks this function which sites are due, so a client in Sydney is
 * processed before one in London without a separate schedule per client.
 */

export const SEND_HOUR = 6;
/** Search Console needs at least two days to settle, so the earliest report day is the 2nd. */
export const REPORT_DAY_MIN = 2;
export const REPORT_DAY_MAX = 8;

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
}

/** Wall-clock date and hour in an IANA time zone. Falls back to UTC for an unknown zone. */
export function localParts(now: Date, timeZone: string): LocalParts {
  let fmt: Intl.DateTimeFormat;
  try {
    fmt = new Intl.DateTimeFormat("en-GB", { timeZone, year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" });
  } catch {
    fmt = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", hourCycle: "h23" });
  }
  const get = (type: string) => Number(fmt.formatToParts(now).find((p) => p.type === type)?.value);
  return { year: get("year"), month: get("month"), day: get("day"), hour: get("hour") };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat("en-GB", { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** The month a client's next report covers, judged by their local calendar. */
export function localReportingPeriod(now: Date, timeZone: string): string {
  const { year, month } = localParts(now, timeZone);
  return addMonths(toPeriod(year, month), -1);
}

/**
 * True once the client's local clock has reached 06:00 on their report
 * day in the month after `period`. Stays true afterwards, so a run that
 * missed the hour (or a site waiting on Search Console) still catches up.
 */
export function isDue(period: string, client: { timezone: string; reportDay: number }, now: Date): boolean {
  const due = addMonths(period, 1);
  const { year, month } = parsePeriod(due);
  const local = localParts(now, client.timezone);
  const localMonth = toPeriod(local.year, local.month);
  if (localMonth > due) return true;
  if (localMonth < due) return false;
  const day = Math.min(Math.max(client.reportDay, REPORT_DAY_MIN), REPORT_DAY_MAX);
  if (local.day !== day) return local.day > day;
  return local.hour >= SEND_HOUR && year === local.year && month === local.month;
}
