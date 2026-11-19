import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

/**
 * The row-level security script applied to a real Postgres: a member of
 * one agency, connected as a non-owner role, sees only their own clients.
 */
describe("row-level security", () => {
  it("lets a member read their own agency and nothing else", async () => {
    const pg = new PGlite();
    await migrate(drizzle(pg), { migrationsFolder: fileURLToPath(new URL("../migrations", import.meta.url)) });
    await pg.exec(readFileSync(fileURLToPath(new URL("../sql/row-level-security.sql", import.meta.url)), "utf8"));
    await pg.exec(`
      insert into organizations (id, name, sender_name, sender_email) values
        ('00000000-0000-0000-0000-00000000000a', 'Northfold', 'N', 'n@x.test'),
        ('00000000-0000-0000-0000-00000000000b', 'Rival', 'R', 'r@x.test');
      insert into users (id, email, name) values ('00000000-0000-0000-0000-0000000000a1', 'maya@x.test', 'Maya');
      insert into memberships (user_id, org_id, role) values ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000a', 'manager');
      insert into clients (org_id, name) values ('00000000-0000-0000-0000-00000000000a', 'Ours'), ('00000000-0000-0000-0000-00000000000b', 'Theirs');
      create role dashboard_reader;
      grant usage on schema public to dashboard_reader;
      grant select on all tables in schema public to dashboard_reader;
    `);
    await pg.exec("set role dashboard_reader");
    const anonymous = await pg.query<{ name: string }>("select name from clients");
    expect(anonymous.rows).toEqual([]);
    await pg.exec("select set_config('app.user_id', '00000000-0000-0000-0000-0000000000a1', false)");
    const member = await pg.query<{ name: string }>("select name from clients order by name");
    expect(member.rows.map((r) => r.name)).toEqual(["Ours"]);
    await pg.close();
  }, 60_000);
});
