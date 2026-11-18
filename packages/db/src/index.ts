import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * as schema from "./schema";
export { schema as tables };

export type Database = ReturnType<typeof createDb>;

/**
 * One small pool per process. Neon and Supabase both cap free-tier
 * connections, so jobs use max: 3 and the dashboard relies on the
 * provider's pooler URL.
 */
export function createDb(url = process.env.DATABASE_URL, { max = 3 }: { max?: number } = {}) {
  if (!url) throw new Error("DATABASE_URL is not set. Run with --demo to use the bundled sample data instead.");
  const client = postgres(url, { max, prepare: false, idle_timeout: 20 });
  return drizzle(client, { schema, casing: "snake_case" });
}

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}
