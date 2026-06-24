# Tasks: AI Live Chat Support Agent

**Branch**: `001-live-chat-agent` | **Plan**: [plan.md](plan.md) | **Spec**: [spec.md](spec.md)

## Task Status Legend
- `[ ]` Not started
- `[~]` In progress
- `[x]` Complete
- `[!]` Blocked

---

## Phase 0 — Project Scaffold & Workspace

### T-001 · Initialise pnpm workspace
**Depends on**: none
**Files**: `package.json`, `pnpm-workspace.yaml`
- [x] Create root `package.json` with `workspaces` referencing `apps/*`
- [x] Create `pnpm-workspace.yaml`
- [x] Add `dev`, `build`, `test` scripts (using `concurrently` or Turborepo)

### T-002 · Bootstrap API app (`apps/api`)
**Depends on**: T-001
**Files**: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/index.ts`
- [x] Initialise `apps/api` package with Hono, TypeScript, Vitest
- [x] Configure `tsconfig.json` (strict, ESM, module resolution = `bundler`)
- [x] Create entry `src/index.ts` that creates a Hono app, adds CORS, and starts the server

### T-003 · Bootstrap Web app (`apps/web`)
**Depends on**: T-001
**Files**: `apps/web/package.json`, `apps/web/tsconfig.json`
- [x] Initialise `apps/web` as a Next.js 14 App Router project
- [x] Configure for TypeScript + ESM
- [x] Add `API_URL` env var reference in `next.config.js`

### T-004 · Environment variable setup
**Depends on**: T-001
**Files**: `.env.example`, `.gitignore`
- [x] Create `.env.example` with: `GEMINI_API_KEY`, `OPENAI_API_KEY`, `API_PORT=3002`, `API_URL=http://localhost:3002`
- [x] Ensure `.env` is in `.gitignore`

---

## Phase 1 — Database Schema & Migration

### T-005 · Define Drizzle schema
**Depends on**: T-002
**Files**: `apps/api/src/db/schema.ts`
- [x] Define `chatConversations` table: `id TEXT PK`, `created_at TIMESTAMP`, `updated_at TIMESTAMP`
- [x] Define `chatMessages` table: `id TEXT PK`, `conversation_id TEXT FK`, `sender TEXT`, `text TEXT`, `timestamp TIMESTAMP`
- [x] Add index on `chatMessages.conversationId`

### T-006 · SQLite client singleton
**Depends on**: T-005
**Files**: `apps/api/src/db/client.ts`, `drizzle.config.ts`
- [x] Create `better-sqlite3` + Drizzle client initialisation
- [x] Configure `drizzle.config.ts` pointing at `./chat.db`
- [x] Add `db:generate` and `db:migrate` scripts to root `package.json`

### T-007 · Generate and apply initial migration
**Depends on**: T-006
**Files**: `drizzle/migrations/` (auto-generated)
- [x] Run `pnpm db:generate` — produces SQL migration file
- [x] Run `pnpm db:migrate` — applies migration to `chat.db`
- [x] Verify tables exist via SQLite CLI or Drizzle Studio

---

## Phase 2 — LLM Service

### T-008 · Implement `generateReply()` service
**Depends on**: T-004
**Files**: `apps/api/src/lib/llm.ts`
- [x] Write `SYSTEM_PROMPT` constant with store domain knowledge (shipping, returns, support hours, strict rules)
- [x] Implement `generateReply(history, userMessage)` with:
  - [x] History trim to last 10 turns
  - [x] `AbortController` with 10 s timeout
  - [x] Gemini 1.5 Flash branch (if `GEMINI_API_KEY` set)
  - [x] OpenAI GPT-4o-mini fallback (if `OPENAI_API_KEY` set)
  - [x] Demo-mode message when neither key is set
  - [x] `AbortError` → throw timeout message
  - [x] HTTP error → log + rethrow
- [x] Export `generateReply`

---

## Phase 3 — Backend API Routes

### T-009 · Implement `POST /chat/message` endpoint
**Depends on**: T-006, T-008
**Files**: `apps/api/src/routes/chat.ts`
- [x] Parse body with `.catch(() => ({}))` malformed-JSON guard
- [x] Validate: non-empty `message` string → 400 `MessageCannotBeEmpty`
- [x] Validate: `message.length <= 2000` → 400 `MessageTooLong`
- [x] Upsert `chatConversations` row (`onConflictDoNothing`)
- [x] Fetch last 10 messages ordered ASC by timestamp
- [x] Call `generateReply()`, catch errors → friendly fallback string
- [x] Insert user message row
- [x] Insert AI reply row
- [x] Update `updated_at` on conversation
- [x] Return `{ reply, sessionId }`

### T-010 · Implement `GET /chat/history/:sessionId` endpoint
**Depends on**: T-006
**Files**: `apps/api/src/routes/chat.ts`
- [x] Fetch all messages for `sessionId` ordered ASC
- [x] Return `{ messages: [{ id, sender, text, timestamp }] }`
- [x] On DB error → 500

### T-011 · Mount chat router in app entry
**Depends on**: T-009, T-010
**Files**: `apps/api/src/index.ts`
- [x] Import and mount the chat router at `/chat`
- [x] Add CORS middleware allowing `http://localhost:3000`
- [x] Start HTTP server on `process.env.API_PORT ?? 3002`

---

## Phase 4 — Next.js Proxy Routes

### T-012 · Proxy `POST /api/chat/message`
**Depends on**: T-003, T-011
**Files**: `apps/web/app/api/chat/message/route.ts`
- [x] Forward POST body to `${API_URL}/chat/message`
- [x] Forward response (status + JSON) back to browser

### T-013 · Proxy `GET /api/chat/history/[sessionId]`
**Depends on**: T-003, T-011
**Files**: `apps/web/app/api/chat/history/[sessionId]/route.ts`
- [x] Forward GET to `${API_URL}/chat/history/${params.sessionId}`
- [x] Forward response back to browser

---

## Phase 5 — Frontend Chat UI

### T-014 · Build chat page component
**Depends on**: T-012, T-013
**Files**: `apps/web/app/chat/page.tsx`
- [x] State: `messages[]`, `inputValue`, `isLoading`, `sessionId`, `error`
- [x] On mount: read `chat_session_id` from `localStorage`; if present, fetch history and populate state
- [x] `handleSendMessage`: validate, set loading, optimistically add user bubble, POST, add AI bubble, store sessionId
- [x] Error handling: surface error banner with dismiss button; clear on next successful send
- [x] "New Chat" button: clear messages, remove `localStorage` key, reset sessionId

### T-015 · Style the chat widget
**Depends on**: T-014
**Files**: `apps/web/app/chat/page.tsx`, `apps/web/app/globals.css`
- [x] Dark glassmorphism card (backdrop-filter blur, translucent background, subtle border, rounded corners)
- [x] Decorative gradient blobs in background
- [x] Header: robot emoji avatar with green active-status dot glow, title + subtitle, New Chat button
- [x] Scrollable message area (`overflow-y: auto`) with `useRef` + `scrollIntoView` auto-scroll
- [x] User bubbles: right-aligned, blue (#3b82f6), border-bottom-right-radius = 4px
- [x] AI bubbles: left-aligned, dark (#1e293b), border-bottom-left-radius = 4px; with small robot avatar
- [x] Typing indicator: 3 bouncing dots CSS keyframe animation
- [x] Error banner: red translucent strip above message area, × dismiss button
- [x] Input + Send button: disabled state + greyed colour when loading or empty
- [x] Import Google Font (Outfit or Inter) in `layout.tsx`

---

## Phase 6 — Testing

### T-016 · Write Vitest unit tests for chat routes
**Depends on**: T-009, T-010
**Files**: `apps/api/tests/chat.test.ts`
- [x] Mock `generateReply` with `vi.mock`
- [x] Test: empty message → 400 `MessageCannotBeEmpty`
- [x] Test: message > 2000 chars → 400 `MessageTooLong`
- [x] Test: valid message → 200, `{ reply, sessionId }`
- [x] Test: GET history after POST → 2 messages, correct senders and text
- [x] Run `pnpm --filter api test` and confirm all pass

---

## Phase 7 — README & Documentation

### T-017 · Write README.md
**Depends on**: all phases complete
**Files**: `README.md`
- [x] How to run locally (step-by-step: install → migrate → dev)
- [x] DB setup (generate + migrate commands)
- [x] Environment variable reference table
- [x] Architecture overview (layers, modules, data flow diagram)
- [x] LLM notes: provider choice, system prompt design, context window management
- [x] Trade-offs & "If I had more time…" section

---

## Completion Checklist

- [x] All T-001 → T-017 tasks marked `[x]`
- [x] `pnpm dev` starts both apps without errors
- [x] Chat end-to-end works in browser at `http://localhost:3000/chat`
- [x] All Vitest tests pass
- [x] `.env` not committed (only `.env.example`)
- [x] README is complete and accurate
