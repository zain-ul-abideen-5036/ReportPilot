import { boolean, date, index, integer, pgTable, primaryKey, real, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { sites } from "./clients";

/** Raw checks, one every five minutes. Retained 30–90 days, then deleted by the rollup job. */
export const uptimeChecks = pgTable(
  "uptime_checks",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    checkedAt: timestamp("checked_at", { withTimezone: true }).notNull(),
    ok: boolean("ok").notNull(),
    status: integer("status"),
    ms: integer("ms"),
    error: text("error"),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.checkedAt] })],
);

/** One row per site per day, kept forever. This is what reports read. */
export const uptimeDaily = pgTable(
  "uptime_daily",
  {
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    day: date("day").notNull(),
    uptimePct: real("uptime_pct").notNull(),
    avgMs: integer("avg_ms").notNull(),
    p95Ms: integer("p95_ms").notNull(),
    incidents: integer("incidents").notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.siteId, t.day] })],
);

export const incidents = pgTable(
  "incidents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    cause: text("cause").notNull(),
    notifiedAt: timestamp("notified_at", { withTimezone: true }),
  },
  (t) => [index("incidents_site_started_idx").on(t.siteId, t.startedAt)],
);

export const tlsDomain = pgTable("tls_domain", {
  siteId: uuid("site_id").primaryKey().references(() => sites.id, { onDelete: "cascade" }),
  certExpiresAt: timestamp("cert_expires_at", { withTimezone: true }),
  issuer: text("issuer"),
  domainExpiresAt: timestamp("domain_expires_at", { withTimezone: true }),
  checkedAt: timestamp("checked_at", { withTimezone: true }).notNull().defaultNow(),
});
