# Spur Agent — AI Live Chat Support

An AI-powered customer support chat widget built for the Spur Founding Full-Stack Engineer Take-Home Assignment.

**Live demo**: http://localhost:3000/chat (after local setup)

---

## 🚀 How to Run Locally

### Prerequisites
- Node.js ≥ 20
- pnpm ≥ 9 — `npm install -g pnpm`

### 1. Install dependencies
```bash
pnpm install
```

### 2. Configure environment variables
```bash
cp .env.example .env
```
Open `.env` and fill in **at least one** LLM key:
```ini
GEMINI_API_KEY=your_gemini_api_key_here   # preferred
OPENAI_API_KEY=your_openai_api_key_here   # fallback
```
If neither key is set the agent runs in **demo mode** (no real LLM — returns a placeholder message).

### 3. Run database migrations
```bash
pnpm db:generate   # generates SQL from schema
pnpm db:migrate    # applies SQL to chat.db
```
This creates `chat.db` (SQLite) in the project root.

### 4. Start both apps
```bash
pnpm dev
```

| Service | URL |
|---------|-----|
| Chat UI | http://localhost:3000/chat |
| API     | http://localhost:3002 |

---

## 🏛️ Architecture Overview

```
spur-agent/
├── apps/
│   ├── api/          ← Hono (Node.js) backend
│   │   ├── src/
│   │   │   ├── db/
│   │   │   │   ├── schema.ts     — Drizzle ORM table definitions
│   │   │   │   ├── client.ts     — SQLite singleton via better-sqlite3
│   │   │   │   └── migrate.ts    — Migration runner script
│   │   │   ├── lib/
│   │   │   │   └── llm.ts        — generateReply() — Gemini + OpenAI
│   │   │   ├── routes/
│   │   │   │   └── chat.ts       — POST /chat/message, GET /chat/history/:id
│   │   │   └── index.ts          — App entry, CORS, route mounting
│   │   └── tests/
│   │       ├── setup.ts          — Runs migrations before test suite
│   │       └── chat.test.ts      — Vitest unit tests (LLM mocked)
│   └── web/          ← Next.js 14 frontend
│       └── app/
│           ├── api/chat/         — Server-side proxy routes (avoid CORS)
│           ├── chat/page.tsx     — Chat widget UI
│           ├── layout.tsx        — Root layout + Outfit font
│           └── globals.css       — Reset + typing animation keyframe
├── drizzle/          — Auto-generated SQL migrations
├── drizzle.config.ts
├── .env.example
└── pnpm-workspace.yaml
```

### Layer responsibilities

| Layer | File(s) | Responsibility |
|-------|---------|----------------|
| Route | `apps/api/src/routes/chat.ts` | Input validation, session management, DB reads/writes |
| Service | `apps/api/src/lib/llm.ts` | LLM API calls, timeout enforcement, demo mode |
| Data | `apps/api/src/db/schema.ts` | Schema definition; `client.ts` — SQLite client |
| Proxy | `apps/web/app/api/chat/` | Forward browser requests to Hono API (keeps API_URL server-side) |
| UI | `apps/web/app/chat/page.tsx` | Chat widget, state management, `localStorage` session persistence |

---

## 🧠 LLM Notes

**Provider**: Google Gemini 1.5 Flash (primary) · OpenAI GPT-4o-mini (fallback)

**System prompt design**: The system prompt is hardcoded in `apps/api/src/lib/llm.ts` and includes:
- Full store FAQ (shipping rates + delivery times, return policy, support hours)
- Strict rules: no hallucination, redirect unknowns to support email, max 4–5 sentences

**Context window management**:
- History is trimmed to the last 10 turns before each LLM call
- Max output tokens: 500 (keeps responses widget-sized)
- Temperature: 0.2 (consistent, fact-based answers)

**Timeout**: `AbortController` with 10-second hard cap. On timeout the user sees a friendly retry message; the backend never crashes.

---

## 🧪 Running Tests

```bash
pnpm test
# or directly:
pnpm --filter api test
```

Tests use Vitest with the LLM mocked via `vi.mock` — no real API calls, no network needed.

Test coverage:
- Empty / whitespace message → 400
- Message > 2000 chars → 400
- Malformed JSON → 400
- Valid message → 200 + `{ reply, sessionId }`
- Auto-generated sessionId when none provided
- History endpoint → correct message count and senders
- History endpoint → empty array for unknown session

---

## ⚖️ Trade-offs & "If I had more time…"

| Decision | Rationale | Future improvement |
|----------|-----------|-------------------|
| **SQLite** instead of PostgreSQL | Simpler local setup — no Docker required | Swap to Postgres + Drizzle (same ORM, minimal code change) |
| **No Redis cache** | SQLite is fast enough for the assignment; in-process reads < 1 ms | Add Valkey/Redis cache-aside for hot sessions under load |
| **Hardcoded system prompt** | Fastest path to store FAQ coverage | Move to DB-seeded FAQ table; let admins edit policies via a CMS |
| **HTTP polling** (no WebSockets) | Request-response is sufficient for single-user chat widget | Add SSE or WebSockets for streaming tokens (feels much faster) |
| **No auth** | Explicitly out of scope per assignment | Session tokens + rate limiting for production |
| **Native `fetch`** (no SDK) | Keeps dependency count minimal, avoids SDK versioning churn | Evaluate Vercel AI SDK for provider abstraction + streaming |
