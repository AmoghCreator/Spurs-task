/**
 * Test setup — runs database migrations before all tests so the
 * in-memory SQLite DB has the correct schema.
 */
import "dotenv/config";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "../src/db/client.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const migrationsFolder = join(__dirname, "../../../drizzle");

migrate(db, { migrationsFolder });
