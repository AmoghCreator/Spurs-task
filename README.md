<div align="center">
  <h1>🚀 Spur AI Live Chat Agent</h1>
  <p><strong>A Highly Extensible, Full-Stack AI Support Agent Architecture</strong></p>
  <p>Built for the Spur Founding Full-Stack Engineer Take-Home Assignment.</p>
</div>

---

## 📖 Table of Contents
1. [The Goal](#1-the-goal)
2. [Live Demo & Setup](#2-live-demo--setup)
3. [Architecture Deep Dive](#3-architecture-deep-dive)
4. [Custom Knowledge Base Engine (`ikai`)](#4-custom-knowledge-base-engine-ikai)
5. [Backend Engineering (Hono + TypeScript)](#5-backend-engineering-hono--typescript)
6. [LLM Orchestration & Streaming](#6-llm-orchestration--streaming)
7. [Data Persistence (SQLite + Drizzle)](#7-data-persistence-sqlite--drizzle)
8. [Frontend Engineering (Next.js 14)](#8-frontend-engineering-nextjs-14)
9. [Testing Strategy](#9-testing-strategy)
10. [Trade-offs & Production Readiness](#10-trade-offs--production-readiness)

---

## 1. The Goal
The objective of this project was to build a robust, production-like live chat widget where an AI agent answers customer questions using real LLM APIs. 

**Key Requirements Addressed**:
- Full conversation persistence.
- Session management.
- Contextual responses based on store domain knowledge (Shipping, Returns, Support hours).
- Graceful error handling and timeouts (no backend crashes).
- Strict validation.

**Bonus Achievements**:
- Implemented **Server-Sent Events (SSE)** for real-time token streaming to the frontend.
- Architected a **Channel Provider Strategy Pattern** to easily bolt on future platforms like WhatsApp or Instagram (Spur's core product offerings).
- Integrated a completely **custom, locally-developed Knowledge Base engine (`ikai`)** to dynamically inject context into the LLM system prompt.

---

## 2. Live Demo & Setup

**Demo URL**: `http://localhost:3000/chat` (Available after local setup)

### Prerequisites
- **Node.js**: `v20+`
- **pnpm**: `v9+` (`npm install -g pnpm`)

### Local Setup Instructions

1. **Clone & Install Dependencies**
   ```bash
   pnpm install
   ```

2. **Configure Environment Variables**
   ```bash
   cp .env.example .env
   ```
   Provide **at least one** LLM API key in your `.env` file to enable real AI responses. If neither is provided, the application safely falls back to an offline "Demo Mode".
   ```ini
   GEMINI_API_KEY=your_gemini_api_key_here   # Priority 1
   OPENAI_API_KEY=your_openai_api_key_here   # Priority 2
   ```

3. **Initialize the Database**
   This project uses SQLite. The following commands will generate the necessary SQL from the Drizzle schema and apply it to a local `chat.db` file.
   ```bash
   pnpm db:generate
   pnpm db:migrate
   ```

4. **Spin up the Monorepo**
   ```bash
   pnpm dev
   ```
   - **Frontend (Next.js)**: Runs on port `3000`.
   - **Backend API (Hono)**: Runs on port `3002`.

---

## 3. Architecture Deep Dive

The repository is structured as a **Turborepo/pnpm workspace monorepo** to strictly decouple the frontend UI from the backend orchestration.

```text
spur-agent/
├── apps/
│   ├── api/                  ← Hono (Node.js) Backend
│   │   ├── kb/               ← Domain Knowledge Markdown Files
│   │   ├── src/
│   │   │   ├── db/           ← Drizzle ORM Schema & Migrations
│   │   │   ├── lib/
│   │   │   │   ├── channels/ ← Strategy Pattern Interfaces
│   │   │   │   ├── llm.ts    ← Provider wrappers (Gemini/OpenAI)
│   │   │   │   └── orchestrator.ts
│   │   │   └── routes/       ← API Route Handlers
│   │   └── tests/            ← Vitest Suite
│   └── web/                  ← Next.js 14 Frontend
├── drizzle/                  ← Auto-generated SQL Migrations
├── ikai-temp-repo/           ← Custom KB Search CLI tool
├── pnpm-workspace.yaml
```

---

## 4. Custom Knowledge Base Engine (`ikai`)

Instead of hardcoding the entire store FAQ into the system prompt or relying on an external vector database like Pinecone, this project leverages **`ikai`**, a custom local CLI tool for knowledge retrieval.

**How it works**:
1. When a user sends a message, `llm.ts` intercepts it and spawns a child process:
   ```typescript
   await execFileAsync("npx", ["--no-install", "ikai-cli", "search", query, "--llm"], { cwd: kbDir });
   ```
2. The `ikai` tool searches through local markdown files stored in `apps/api/kb/mrspurs/` (e.g., `AGENTS.md`, `CLAUDE.md`).
3. The retrieved markdown chunks are dynamically injected into the system prompt under a strict `=== RELEVANT KNOWLEDGE BASE CONTEXT ===` block.

This achieves **Retrieval-Augmented Generation (RAG)** entirely locally, proving the extensibility of the architecture and allowing store owners to update their policies simply by editing markdown files in the repository.

---

## 5. Backend Engineering (Hono + TypeScript)

The backend is built with **Hono**, chosen for its extreme lightweight footprint and incredible execution speed.

### The Channel Provider Pattern (Strategy Pattern)
Spur is an omnichannel platform (Live Chat, WhatsApp, Instagram). To emulate this, the backend doesn't hardcode HTTP request parsing into the LLM logic. Instead, it uses `BaseChannel.ts`.

- **`LiveChatChannel.ts`**: Parses standard JSON bodies and responds using **Server-Sent Events (SSE)** via `hono/streaming`. This allows the browser to render the agent's typing in real-time.
- **`WhatsAppChannel.ts`**: Simulates a Twilio/Meta webhook. It parses the specific webhook payload, immediately responds with a `202 Accepted` (to prevent webhook timeouts), and consumes the LLM stream asynchronously in the background.

### The Orchestrator (`orchestrator.ts`)
The `orchestrator.ts` file is the central nervous system. It:
1. Receives the normalized `ChannelRequest` (message + sessionId).
2. Upserts the session into the database.
3. Persists the user's message.
4. Fetches the last 10 messages of history for context.
5. Invokes the `llm.ts` stream.
6. Catches the stream completion and persists the AI's final reply to the database.

---

## 6. LLM Orchestration & Streaming

The `llm.ts` file abstracts the complexities of different LLM providers behind a single `generateReplyStream` asynchronous generator.

**Key Features**:
- **Provider Fallback**: Attempts Gemini 1.5 Flash first. If the key is missing or fails, it falls back to OpenAI GPT-4o-mini. If neither exists, it yields a safe "Demo Mode" string.
- **Strict Guardrails**: 
  - **10-Second Hard Timeout**: Wraps the network request in an `AbortController`. If the LLM hangs, the backend aborts the request and throws a friendly error to the UI. The server never crashes.
  - **Context Trimming**: Only the last 10 messages are sent to the LLM to tightly control token usage and cost.
  - **Prompt Injection Defense**: User messages are wrapped in `<user_message>` tags, explicitly instructing the LLM to treat them as literal text and ignore malicious instructions.

---

## 7. Data Persistence (SQLite + Drizzle)

The data layer uses **SQLite** combined with **Drizzle ORM**. SQLite was chosen to make the take-home assignment trivial to run locally without requiring Docker or PostgreSQL installation.

**The Schema**:
```typescript
export const chatConversations = sqliteTable("chat_conversations", {
  id: text("id").primaryKey(),
  channelOrigin: text("channel_origin").notNull().default("web"),
  createdAt: integer("created_at", { mode: "timestamp" }).default(sql`(unixepoch())`),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").references(() => chatConversations.id, { onDelete: "cascade" }),
  sender: text("sender", { enum: ["user", "ai"] }).notNull(),
  text: text("text").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" }).default(sql`(unixepoch())`),
});
```
*Note the `onDelete: "cascade"` relationship ensuring data integrity.*

---

## 8. Frontend Engineering (Next.js 14)

The frontend is a sleek, modern Next.js 14 application leveraging the App Router.

- **Proxy Routing**: The browser never talks to the Hono API directly. Requests go to `apps/web/app/api/chat/route.ts` which proxies them to the backend. This eliminates CORS complexities and securely hides the API architecture from the client.
- **Session Persistence**: On mount, the chat widget generates a UUID and saves it to `localStorage`. On refresh, it retrieves the UUID and hits the `/chat/history/:sessionId` endpoint to perfectly restore the user's conversation state.
- **Streaming UI**: Uses standard `fetch` with the native Streams API (`TextDecoderStream`) to read SSE chunks and append them to the UI state instantly.
- **Aesthetics**: Features smooth scrolling, typing indicators, disabled buttons during inflight requests, and the clean `Outfit` font stack.

---

## 9. Testing Strategy

```bash
pnpm test
```

The backend is fully tested using **Vitest**. 
- Network calls to Gemini/OpenAI are mocked via `vi.mock()`.
- A global test setup script (`setup.ts`) automatically generates and drops an in-memory SQLite schema before the suite runs.
- **Coverage includes**:
  - Rejection of empty/whitespace messages.
  - Rejection of payloads exceeding 2000 characters.
  - Auto-generation of session UUIDs if omitted.
  - Valid End-to-End mock generation.
  - History endpoint verification.

---

## 10. Trade-offs & Production Readiness

While this architecture is robust, moving to a production environment handling millions of users would require the following pivots:

| Current Implementation | Production Requirement | Rationale |
|------------------------|------------------------|-----------|
| **SQLite (Local File)** | **PostgreSQL** | SQLite locks on heavy concurrent writes. Moving to Postgres via Drizzle requires modifying about 3 lines of connection code. |
| **No In-Memory Cache** | **Redis / Valkey** | Currently, history is fetched from disk on every message. A cache-aside pattern in Redis would be needed for hot sessions. |
| **HTTP Polling/SSE** | **WebSockets** | SSE is great for one-way streams, but full bi-directional WebSockets reduce connection overhead for long-lived chat sessions. |
| **No Authentication** | **JWT / API Gateway** | The current API is open. Production requires rate limiting (e.g., Upstash) and signed JWTs to prevent abuse. |
| **Local `ikai` CLI** | **Vector Database (Pinecone)** | Spawning child processes for KB searches doesn't scale horizontally. We would move the markdown data into embeddings in a Vector DB. |
