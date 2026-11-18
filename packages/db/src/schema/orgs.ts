import { pgEnum, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "manager", "viewer"]);

/** An agency. Every other row hangs off one, and every query is scoped by it. */
export const organizations = pgTable("organizations", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  brandLogoKey: text("brand_logo_key"),
  brandPrimary: text("brand_primary").notNull().default("#1f4d3f"),
  brandAccent: text("brand_accent").notNull().default("#c8763b"),
  senderName: text("sender_name").notNull(),
  senderEmail: text("sender_email").notNull(),
  footer: text("footer").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    orgId: uuid("org_id").notNull().references(() => organizations.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("manager"),
  },
  (t) => [primaryKey({ columns: [t.userId, t.orgId] })],
);
