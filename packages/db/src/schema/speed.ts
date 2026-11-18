import { date, index, integer, jsonb, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { SpeedOpportunity } from "@reportpilot/core";
import { sites } from "./clients";

/** Weekly Lighthouse results: the median of three runs per URL and strategy. */
export const psiRuns = pgTable(
  "psi_runs",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    strategy: text("strategy").$type<"mobile" | "desktop">().notNull(),
    runDate: date("run_date").notNull(),
    perfScore: integer("perf_score").notNull(),
    lcp: integer("lcp"),
    cls: real("cls"),
    tbt: integer("tbt"),
    fcp: integer("fcp"),
    opportunities: jsonb("opportunities").$type<SpeedOpportunity[]>().notNull().default([]),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.url, t.strategy, t.runDate] })],
);

/** Chrome UX Report history: real-visitor p75 per week. */
export const cruxWeekly = pgTable(
  "crux_weekly",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    urlOrOrigin: text("url_or_origin").notNull(),
    week: date("week").notNull(),
    formFactor: text("form_factor").$type<"PHONE" | "DESKTOP" | "ALL">().notNull(),
    lcpP75: integer("lcp_p75"),
    inpP75: integer("inp_p75"),
    clsP75: real("cls_p75"),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.urlOrOrigin, t.week, t.formFactor] })],
);

/** URL Inspection results for key pages (quota: 2,000 a day per property). */
export const indexStatus = pgTable(
  "index_status",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    verdict: text("verdict").$type<"PASS" | "NEUTRAL" | "FAIL">().notNull(),
    coverageState: text("coverage_state").notNull(),
    lastCrawl: timestamp("last_crawl", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.url, t.checkedAt] }), index("index_status_site_idx").on(t.siteId)],
);
