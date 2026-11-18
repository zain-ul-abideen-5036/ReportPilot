import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { organizations, users } from "./orgs";

export const clientStatusEnum = pgEnum("client_status", ["active", "paused", "archived"]);

export interface Contact {
  name: string;
  email: string;
  /** Set when an email to this contact bounces, so the dashboard can flag it. */
  bouncedAt?: string;
}

export const clients = pgTable(
  "clients",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    logoKey: text("logo_key"),
    /** The only personal data we hold. Documented in docs/privacy.md. */
    contacts: jsonb("contacts").$type<Contact[]>().notNull().default([]),
    timezone: text("timezone").notNull().default("Europe/London"),
    reportDay: integer("report_day").notNull().default(3),
    managerId: uuid("manager_id").references(() => users.id, { onDelete: "set null" }),
    autoSend: boolean("auto_send").notNull().default(false),
    aiEnabled: boolean("ai_enabled").notNull().default(true),
    status: clientStatusEnum("status").notNull().default("active"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("clients_org_idx").on(t.orgId)],
);

export const sites = pgTable(
  "sites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    clientId: uuid("client_id").notNull().references(() => clients.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    /** "sc-domain:example.com" or a URL-prefix property. */
    gscProperty: text("gsc_property"),
    brandedRegex: text("branded_regex"),
    keyPages: text("key_pages").array().notNull().default([]),
    uptimeKeyword: text("uptime_keyword"),
    active: boolean("active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("sites_client_idx").on(t.clientId)],
);
