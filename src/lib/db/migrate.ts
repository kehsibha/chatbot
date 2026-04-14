/**
 * Run drizzle migrations from the drizzle/ folder against the local SQLite DB.
 * Invoked by `pnpm db:migrate`.
 */
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";

const DB_PATH = process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./gtd.db";

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite);

console.log(`Running migrations against ${DB_PATH}...`);
migrate(db, { migrationsFolder: "./drizzle" });
console.log("Migrations complete.");
sqlite.close();
