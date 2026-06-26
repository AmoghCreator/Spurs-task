# Implementation Plan: Chatbot Production Resiliency & Idiot-Proofing

**Branch**: `003-chatbot-resiliency` | **Date**: 2026-06-26 | **Spec**: [spec.md](file:///home/ascii_heart/Documents/spur-agent/specs/003-chatbot-resiliency/spec.md)
**Input**: Feature specification from `/specs/003-chatbot-resiliency/spec.md`

## Summary

Implement backend and frontend resiliency changes to protect the chat system against input floods, connection drops, oversized payloads, prompt injections, and client-side page closures. Upgrade the communication protocol to token-by-token streaming via Server-Sent Events (SSE). Expose contextual quick reply chips to prevent cold-start friction, and build a local state tracker to shift the user interface into a graceful emergency fallback UI when sequential connection errors are encountered.

## Technical Context

**Language/Version**: TypeScript / Node.js 22 / Next.js 14  
**Primary Dependencies**: React 18, Next.js, Hono, Drizzle ORM  
**Storage**: SQLite (`better-sqlite3`)  
**Testing**: Vitest  
**Target Platform**: Web (Mobile, Tablet, Desktop)  
**Project Type**: Next.js App & Hono API monorepo  
**Performance Goals**: Instant token-by-token streaming, UI block under 1ms on submit, sliding watchdog timeout under 8 seconds.  
**Constraints**: Pure CSS styling, strict input character validation (2000 chars), failover threshold of 2 consecutive failures.  
**Scale/Scope**: Frontend chat view (`apps/web/app/chat/page.tsx`), Next.js API route (`apps/web/app/api/chat/message/route.ts`), and backend Hono services/routes.

## Constitution Check

*GATE: Passed*

## Project Structure

### Documentation (this feature)

```text
specs/003-chatbot-resiliency/
├── plan.md              # This file
├── research.md          # Styling, watchdog, and streaming details
├── data-model.md        # Database session tracking adjustments
└── quickstart.md        # Quickstart verification and startup commands
```

### Source Code

```text
apps/api/
├── src/
│   ├── routes/
│   │   └── chat.ts      # Backend message stream endpoint and error tracking
│   └── lib/
│       └── llm.ts       # Unified LLM stream wrappers for Gemini & OpenAI
└── tests/

apps/web/
├── app/
│   ├── api/
│   │   └── chat/
│   │       └── message/
│   │           └── route.ts  # Stream forwarding proxy route
│   └── chat/
│       └── page.tsx     # Quick replies, concurrency defense, watchdog, emergency UI
```

**Structure Decision**: Web application option. The monorepo manages frontend routes under `apps/web` and API handlers under `apps/api`.
