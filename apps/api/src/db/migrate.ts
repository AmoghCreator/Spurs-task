/**
 * Migration runner — applies all pending Drizzle migrations to the SQLite database.
 * Run with: pnpm db:migrate
 */
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationsFolder = join(__dirname, "../../../../drizzle");

console.log("Running migrations from:", migrationsFolder);
migrate(db, { migrationsFolder });
console.log("✅ Migrations applied successfully.");
