import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { db } from "./client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from monorepo root
dotenv.config({ path: join(__dirname, "../../../../.env") });

const migrationsFolder = join(__dirname, "../../../../drizzle");

console.log("Running migrations from:", migrationsFolder);
migrate(db, { migrationsFolder });
console.log("✅ Migrations applied successfully.");
