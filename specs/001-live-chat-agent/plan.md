# Implementation Plan: AI Live Chat Support Agent

**Branch**: `001-live-chat-agent` | **Date**: 2026-06-25 | **Spec**: [spec.md](spec.md)

## Summary

Build a standalone AI live chat application from scratch as a separate project (independent of the `lobstral` monorepo). The implementation mirrors the design validated in the adjacent lobstral proof-of-concept but lives in its own clean project structure:

1. **Backend** — Node.js + TypeScript (Hono framework) exposing `POST /chat/message` and `GET /chat/history/:sessionId`, with LLM integration (Gemini / OpenAI) and SQLite persistence via Drizzle ORM.
2. **Frontend** — Next.js (App Router) serving a `/chat` page with a glassmorphism dark-mode chat widget, typing indicators, session persistence, and auto-scroll.
3. **Database** — SQLite (development simplicity per assignment guidelines) with Drizzle ORM, two tables: `chat_conversations` and `chat_messages`.
4. **LLM Service** — Encapsulated `generateReply(history, userMessage)` function supporting Gemini 1.5 Flash (primary) and OpenAI GPT-4o-mini (fallback), with 10-second AbortController timeout.

## Technical Context

- **Language**: TypeScript throughout
- **Backend runtime**: Node.js with Hono
- **Frontend**: Next.js 14 (App Router)
- **Database**: SQLite via `better-sqlite3` + Drizzle ORM
- **LLM Providers**: Google Gemini API, OpenAI API (via native `fetch`, no SDK)
- **Monorepo tool**: pnpm workspaces (backend + frontend packages)
- **Testing**: Vitest for API route unit tests
- **Performance targets**: AI reply end-to-end < 3 s (LLM latency dominant), DB ops < 5 ms (SQLite in-process)
- **Constraints**: 10 s LLM timeout cap, max message size 2000 chars, no auth required

## Project Structure

```text
spur-agent/
├── apps/
│   ├── api/                          ← Hono backend
│   │   ├── src/
│   │   │   ├── lib/
│   │   │   │   └── llm.ts            ← generateReply() — Gemini / OpenAI
│   │   │   ├── routes/
│   │   │   │   └── chat.ts           ← POST /chat/message, GET /chat/history/:id
│   │   │   ├── db/
│   │   │   │   ├── schema.ts         ← Drizzle schema (conversations + messages)
│   │   │   │   └── client.ts         ← SQLite client singleton
│   │   │   └── index.ts              ← App entry, route mounting, CORS
│   │   ├── tests/
│   │   │   └── chat.test.ts          ← Vitest unit tests (mocked LLM)
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── web/                          ← Next.js frontend
│       ├── app/
│       │   ├── api/
│       │   │   └── chat/
│       │   │       ├── message/route.ts        ← Proxy → backend
│       │   │       └── history/[id]/route.ts   ← Proxy → backend
│       │   ├── chat/
│       │   │   └── page.tsx          ← Chat widget page
│       │   ├── layout.tsx
│       │   └── globals.css
│       ├── package.json
│       └── tsconfig.json
├── .env.example
├── .env                              ← (git-ignored) actual keys
├── drizzle.config.ts
├── package.json                      ← pnpm workspace root
└── pnpm-workspace.yaml
```

## Phase 0 — Project Scaffold & Workspace Setup ✅

1. Initialise pnpm workspace with `apps/api` and `apps/web` packages.
2. Configure root `package.json` with `dev`, `build`, `test` scripts via Turborepo or concurrently.
3. Create `.env.example` documenting `GEMINI_API_KEY`, `OPENAI_API_KEY`, `API_PORT`, `API_URL`.
4. Configure `tsconfig.json` for both apps (strict mode, module resolution `bundler`).

## Phase 1 — Database Schema & Migration ✅

1. Define `packages/db` (or `apps/api/src/db/`):
   - `chatConversations` table: `id` TEXT PK, `created_at` TIMESTAMP, `updated_at` TIMESTAMP.
   - `chatMessages` table: `id` TEXT PK, `conversation_id` TEXT FK→conversations (cascade delete), `sender` TEXT (`"user"` | `"ai"`), `text` TEXT, `timestamp` TIMESTAMP.
   - Index on `chat_messages.conversation_id` for fast history lookups.
2. Generate and apply migration with Drizzle Kit (`pnpm db:generate && pnpm db:migrate`).

## Phase 2 — LLM Service Client ✅

File: `apps/api/src/lib/llm.ts`

1. Hardcode store system prompt covering:
   - Shipping: domestic 5–7 days ($5.99 flat / free over $50), international 7–14 days ($14.99).
   - Returns: 30-day window, original packaging, free domestic return shipping, 5–7 day refund processing.
   - Support hours: Mon–Fri 9 AM–5 PM EST, `support@lobstral-store.com`.
   - Strict rules: no hallucination, redirect unknowns to support email, ≤ 5 sentences per reply.
2. Implement `generateReply(history, userMessage)`:
   - Trim history to last 10 turns (cost control).
   - Prefer `GEMINI_API_KEY` → Gemini 1.5 Flash endpoint; fallback to `OPENAI_API_KEY` → GPT-4o-mini.
   - Enforce 10 s timeout via `AbortController`.
   - On `AbortError`: throw `"The request timed out. Please try again."`.
   - On HTTP error: log and rethrow.
   - On no key: return demo-mode message (no crash).

## Phase 3 — Backend API Routes ✅

File: `apps/api/src/routes/chat.ts`

1. `POST /message`:
   - Parse body with `.catch(() => ({}))` guard for malformed JSON.
   - Validate: `message` is non-empty string, length ≤ 2000 → HTTP 400 on failure.
   - Upsert `chatConversations` row (`.onConflictDoNothing()`).
   - Fetch last 10 `chatMessages` for session, ordered ASC by timestamp.
   - Call `generateReply()`, catch LLM errors → friendly fallback string.
   - Insert user message row, insert AI reply row, update `updated_at`.
   - Return `{ reply, sessionId }`.

2. `GET /history/:sessionId`:
   - Fetch all messages for session ordered ASC by timestamp.
   - Return `{ messages: [...] }`.
   - On DB error → HTTP 500.

3. Mount in `apps/api/src/index.ts` at prefix `/chat` with CORS allowing the frontend origin.

## Phase 4 — Next.js API Proxy Routes ✅

Files: `apps/web/app/api/chat/message/route.ts` and `apps/web/app/api/chat/history/[sessionId]/route.ts`

- Forward requests to `process.env.API_URL ?? "http://localhost:3002"`.
- Avoids browser CORS restrictions; keeps backend URL server-side only.

## Phase 5 — Frontend Chat UI ✅

File: `apps/web/app/chat/page.tsx`

1. State: `messages[]`, `inputValue`, `isLoading`, `sessionId`, `error`.
2. On mount:
   - Read `chat_session_id` from `localStorage`.
   - If exists, `GET /api/chat/history/:id` and populate message list.
3. `handleSendMessage(e)`:
   - Prevent default, validate non-empty, set loading.
   - Optimistically append user bubble.
   - `POST /api/chat/message` → append AI bubble.
   - Store `sessionId` in `localStorage`.
   - On error: surface banner with dismiss button.
4. UI elements:
   - Dark glassmorphism card (backdrop blur, translucent bg, subtle border).
   - Header: robot avatar with green active status dot, "Lobstral Support" title, subtitle, **New Chat** button.
   - Scrollable message area with `useRef` auto-scroll.
   - Animated bouncing typing indicator (3 CSS dots) during loading.
   - Input field + Send button (disabled + greyed when loading or empty).
   - Error banner with dismiss (×) button.

## Phase 6 — Testing ✅

File: `apps/api/tests/chat.test.ts`

Test cases (LLM mocked via `vi.mock`):
1. Empty message → HTTP 400 `MessageCannotBeEmpty`.
2. Message > 2000 chars → HTTP 400 `MessageTooLong`.
3. Valid message → HTTP 200, `{ reply, sessionId }`.
4. `GET /history/:id` after a POST → 2 messages (user + AI), correct senders.

Run: `pnpm --filter api test`

## Phase 7 — README & Documentation ✅

`README.md` at project root covering:
- How to run locally (step by step).
- DB setup (migration commands).
- Environment variable reference.
- Architecture overview (layers, modules, data flow).
- LLM notes (provider, prompting strategy).
- Trade-offs & "If I had more time…" section.
