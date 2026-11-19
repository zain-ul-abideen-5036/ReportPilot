import { index, integer, jsonb, pgEnum, pgTable, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Narrative, ReportData } from "@reportpilot/core";
import { sites } from "./clients";
import { organizations, users } from "./orgs";

export const reportStatusEnum = pgEnum("report_status", ["collecting", "draft", "in_review", "approved", "sent", "failed"]);
export const stageEnum = pgEnum("stage", ["plan", "collect", "calculate", "insights", "narrative", "render", "review", "deliver"]);
export const runStatusEnum = pgEnum("run_status", ["running", "succeeded", "failed", "waiting"]);

/**
 * One report per site per month. The unique index on (site_id, period) is
 * what makes the pipeline idempotent: re-running plan never duplicates.
 */
export const reports = pgTable(
  "reports",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    period: text("period").notNull(),
    status: reportStatusEnum("status").notNull().default("collecting"),
    /** Collected inputs, saved after the collect stage so later stages can resume. */
    collected: jsonb("collected"),
    data: jsonb("data").$type<ReportData>(),
    narrative: jsonb("narrative").$type<Narrative>(),
    managerNotes: text("manager_notes"),
    pdfKey: text("pdf_key"),
    /** Random 128-bit token, hex. Null once revoked. */
    shareToken: text("share_token").unique(),
    shareExpiresAt: timestamp("share_expires_at", { withTimezone: true }),
    approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    /** Resend's message id, so delivery and bounce webhooks can find the report. */
    deliveryId: text("delivery_id"),
    deliveryStatus: text("delivery_status").$type<"queued" | "delivered" | "bounced" | "complained">(),
    deliveryUpdatedAt: timestamp("delivery_updated_at", { withTimezone: true }),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("reports_site_period_uq").on(t.siteId, t.period),
    index("reports_status_idx").on(t.status),
    index("reports_delivery_idx").on(t.deliveryId),
  ],
);

/**
 * Every rendered PDF is kept as a version. Re-rendering after a note
 * changes bumps reports.version and adds a row here, so "what did the
 * client actually receive?" always has an answer.
 */
export const reportVersions = pgTable(
  "report_versions",
  {
    reportId: uuid("report_id").notNull().references(() => reports.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    pdfKey: text("pdf_key").notNull(),
    reason: text("reason").notNull().default("render"),
    createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.reportId, t.version] })],
);

export const jobRuns = pgTable(
  "job_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    kind: text("kind").$type<"monthly" | "weekly" | "backfill">().notNull(),
    siteId: uuid("site_id").references(() => sites.id, { onDelete: "cascade" }),
    period: text("period"),
    stage: stageEnum("stage").notNull(),
    status: runStatusEnum("status").notNull().default("running"),
    attempts: integer("attempts").notNull().default(1),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (t) => [index("job_runs_site_period_idx").on(t.siteId, t.period)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    /** Null for actions the system took on its own (auto-send, retries). */
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    action: text("action").notNull(),
    entity: text("entity").notNull(),
    entityId: uuid("entity_id"),
    at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default({}),
  },
  (t) => [index("audit_org_at_idx").on(t.orgId, t.at)],
);

export const alerts = pgTable(
  "alerts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    siteId: uuid("site_id").notNull().references(() => sites.id, { onDelete: "cascade" }),
    kind: text("kind").$type<"downtime" | "ssl" | "domain" | "traffic" | "vitals" | "indexing" | "bounce">().notNull(),
    severity: text("severity").$type<"critical" | "warning">().notNull(),
    state: text("state").$type<"open" | "acknowledged" | "resolved">().notNull().default("open"),
    title: text("title").notNull(),
    detail: text("detail").notNull().default(""),
    /** Prevents the same condition alerting twice, e.g. "ssl:2026-11". */
    dedupeKey: text("dedupe_key").notNull(),
    raisedAt: timestamp("raised_at", { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("alerts_site_dedupe_uq").on(t.siteId, t.dedupeKey)],
);
