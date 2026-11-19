/**
 * A throwaway Postgres for trying the database mode locally, with no
 * install and no cloud account: PGlite (Postgres compiled to WebAssembly)
 * behind its Postgres-protocol socket server, with the migrations applied.
 *
 *   npx tsx scripts/local-db.ts            # listens on 127.0.0.1:5544
 *   DATABASE_URL=postgres://postgres@127.0.0.1:5544/postgres npm run seed -w @reportpilot/db
 *
 * PGlite is a single Postgres session, so run the app with
 * DATABASE_POOL_MAX=1. Data lives in memory and disappears when the
 * process stops.
 */
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";

const port = Number(process.env.PORT ?? 5544);
const db = new PGlite();
await migrate(drizzle(db), { migrationsFolder: fileURLToPath(new URL("../packages/db/migrations", import.meta.url)) });
const server = new PGLiteSocketServer({ db, port, host: "127.0.0.1", maxConnections: 1 });
await server.start();
console.log(`Postgres (PGlite) ready: postgres://postgres@127.0.0.1:${port}/postgres`);

const stop = async () => {
  await server.stop();
  await db.close();
  process.exit(0);
};
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
