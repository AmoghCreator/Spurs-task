import dotenv from "dotenv";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Load .env from the monorepo root (two levels above apps/api/src)
dotenv.config({ path: join(__dirname, "../../../.env") });
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { chat } from "./routes/chat.js";

export const app = new Hono();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(
  "/*",
  cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
    allowMethods: ["GET", "POST", "OPTIONS"],
    allowHeaders: ["Content-Type"],
  })
);

// ── Routes ────────────────────────────────────────────────────────────────────
app.get("/health", (c) => c.json({ status: "ok" }));
app.route("/chat", chat);

// ── Server ────────────────────────────────────────────────────────────────────
const port = Number(process.env.API_PORT ?? 3002);

serve({ fetch: app.fetch, port }, () => {
  console.log(`✅ API server running at http://localhost:${port}`);
});
