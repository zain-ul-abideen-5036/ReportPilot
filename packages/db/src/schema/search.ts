import { date, integer, pgTable, primaryKey, real, text, uuid } from "drizzle-orm/pg-core";
import { sites } from "./clients";

/*
 * Storage discipline: we keep monthly aggregates, not every row Search
 * Console returns. 50 sites x 1,000 queries x 12 months is about 600,000
 * rows, which fits comfortably in a free Postgres tier.
 */

const metrics = {
  clicks: integer("clicks").notNull(),
  impressions: integer("impressions").notNull(),
  ctr: real("ctr").notNull(),
  position: real("position").notNull(),
};

/** Site totals per day, for the daily chart. */
export const gscDaily = pgTable(
  "gsc_daily",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    ...metrics,
  },
  (t) => [primaryKey({ columns: [t.siteId, t.day] })],
);

/** Top 1,000 queries per month. */
export const gscMonthlyQuery = pgTable(
  "gsc_monthly_query",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    query: text("query").notNull(),
    ...metrics,
  },
  (t) => [primaryKey({ columns: [t.siteId, t.month, t.query] })],
);

/** Top 500 pages per month. */
export const gscMonthlyPage = pgTable(
  "gsc_monthly_page",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    page: text("page").notNull(),
    ...metrics,
  },
  (t) => [primaryKey({ columns: [t.siteId, t.month, t.page] })],
);

/** Device and country splits per month. */
export const gscMonthlyDim = pgTable(
  "gsc_monthly_dim",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    month: text("month").notNull(),
    dimension: text("dimension").$type<"device" | "country">().notNull(),
    key: text("key").notNull(),
    clicks: integer("clicks").notNull(),
    impressions: integer("impressions").notNull(),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.month, t.dimension, t.key] })],
);
