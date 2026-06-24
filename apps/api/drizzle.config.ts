import { defineConfig } from "drizzle-kit";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  schema: join(__dirname, "src/db/schema.ts"),
  out: join(__dirname, "../../drizzle"),
  dialect: "sqlite",
  dbCredentials: {
    url: join(__dirname, "../../chat.db"),
  },
});
