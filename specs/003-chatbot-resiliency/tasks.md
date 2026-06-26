# Tasks: Chatbot Production Resiliency & Idiot-Proofing

**Input**: Design documents from `/specs/003-chatbot-resiliency/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/message-stream.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in all task descriptions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Update the database schema and shared configuration in preparation for all resiliency changes.

- [x] T001 Extend `chatConversations` schema in `apps/api/src/db/schema.ts` to add `channelOrigin` (text, default `"web"`) and `metadata` (text, nullable) columns
- [x] T002 Generate the SQLite migration after schema changes (`pnpm db:generate && pnpm db:migrate`)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core backend infrastructure changes that MUST be complete before any user story can proceed.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T003 Refactor `generateReply()` in `apps/api/src/lib/llm.ts` to wrap user messages in `<user_message>...</user_message>` XML tags in both the Gemini and OpenAI system prompt context, and add an explicit instruction to treat content inside the tags as literal plain text only
- [x] T004 [P] Add a `generateReplyStream()` function to `apps/api/src/lib/llm.ts` that accepts an `AbortSignal` and returns an `AsyncIterable<string>` of text tokens — implement for Gemini using `streamGenerateContent?alt=sse` and for OpenAI using `"stream": true` on `/v1/chat/completions`
- [x] T005 [P] Replace the `POST /chat/message` handler in `apps/api/src/routes/chat.ts` with a streaming SSE endpoint using Hono's `streamSSE()` helper — stream tokens as `data: {"token": "...", "sessionId": "..."}` events, finalize with `data: [DONE]`, and register `stream.onAbort()` to abort the upstream LLM `AbortController` immediately when the client disconnects
- [x] T006 Update the Next.js proxy route in `apps/web/app/api/chat/message/route.ts` to forward the raw `ReadableStream` from the Hono API back to the browser with `Content-Type: text/event-stream` headers, removing the previous `res.json()` call

**Checkpoint**: Foundation ready — streaming infrastructure is operational end-to-end.

---

## Phase 3: User Story 1 — Real-Time Streaming & Quick Replies (Priority: P1) 🎯 MVP

**Goal**: Users see AI responses stream token-by-token, and quick reply chips let users start a conversation instantly.

**Independent Test**: Open `/chat`, click a quick reply chip (e.g. "Shipping to USA?"), and verify the message is auto-submitted and the AI response appears token-by-token in the bubble.

### Implementation for User Story 1

- [x] T007 [US1] Add a `streamingText` field (string) to the `Message` interface in `apps/web/app/chat/page.tsx` to track the in-progress streamed content separately from the finalized `text` field
- [x] T008 [US1] Rewrite `handleSendMessage` in `apps/web/app/chat/page.tsx` to open a `fetch` stream to `/api/chat/message`, read the `ReadableStream` with a `TextDecoder`, parse SSE `data:` lines as JSON, and append each `token` value to the streaming message bubble in React state
- [x] T009 [US1] Update the message bubble render in `apps/web/app/chat/page.tsx` to display `streamingText` during an active stream, transitioning to the finalized `text` once `[DONE]` is received and the message is committed to state
- [x] T010 [US1] Update `SUGGESTIONS` chips in `apps/web/app/chat/page.tsx` so clicking a chip both sets `inputValue` AND immediately calls `handleSendMessage` (auto-submits without requiring a separate button press)

**Checkpoint**: US1 fully functional — streaming works end-to-end and quick reply chips auto-submit.

---

## Phase 4: User Story 2 — Input Flood & Oversized Payload Defense (Priority: P2)

**Goal**: The system blocks rapid double-clicks, keyboard hammering, and oversized copy-paste inputs at both the DOM and API layers.

**Independent Test**: Double-click the submit button rapidly, and paste 2001+ characters, and verify that no duplicate requests are ever dispatched and that the API returns a `400 MessageTooLong` error if the DOM is bypassed.

### Implementation for User Story 2

- [x] T011 [US2] In `apps/web/app/chat/page.tsx`, change the `<input>` `maxLength` from `2100` to `2000` to enforce the character cap directly at the DOM level, and add a live character counter display beneath the input that turns red when approaching the limit
- [x] T012 [US2] Confirm that `isLoading` is set to `true` synchronously at the very start of `handleSendMessage` before any async operations in `apps/web/app/chat/page.tsx`, ensuring the send button and input are disabled within the same event-loop tick as submission
- [x] T013 [US2] Bind each new outgoing message to a unique `messageId` (generated with `crypto.randomUUID()`) at the moment of submission in `apps/web/app/chat/page.tsx`, and scope all stream token appends to that specific `messageId` to prevent concurrent stream buffers from overlapping
- [x] T014 [US2] Verify that `apps/api/src/routes/chat.ts` rejects messages over 2000 characters with `{ error: "MessageTooLong" }` and HTTP 400 (already implemented — confirm still correct after streaming refactor in T005)

**Checkpoint**: US2 fully functional — no race conditions, double submissions, or oversized payloads accepted.

---

## Phase 5: User Story 3 — Consecutive Failure Fallback & Watchdog (Priority: P3)

**Goal**: The system detects hanging connections and repeated failures, automatically switching to an emergency support contact UI after 2 consecutive failures.

**Independent Test**: Simulate a mid-stream network dropout (disconnect the API server) and verify the UI times out within 8 seconds, increments the failure counter, and after 2 failures replaces the chat interface with the emergency fallback UI.

### Implementation for User Story 3

- [x] T015 [US3] Add `consecutiveFailures` (number, initial `0`) and `isEmergencyMode` (boolean, initial `false`) to React state in `apps/web/app/chat/page.tsx`
- [x] T016 [US3] Implement a sliding-window watchdog timer inside `handleSendMessage` in `apps/web/app/chat/page.tsx`: start an 8-second `setTimeout` when the stream begins, reset/clear it on every received token chunk, and if it fires — abort the stream via `AbortController.abort()`, record the failure as a timed-out message, and call the failure-increment handler
- [x] T017 [US3] Implement a `handleFailure()` helper in `apps/web/app/chat/page.tsx` that increments `consecutiveFailures` and sets `isEmergencyMode = true` when the count reaches `2`; also implement a `handleSuccess()` helper that resets `consecutiveFailures` to `0` — call these at the end of `handleSendMessage` on failure and success respectively
- [x] T018 [US3] Add an `EmergencyFallback` inline component/section in `apps/web/app/chat/page.tsx` that renders when `isEmergencyMode === true` — display a high-visibility panel showing support email (`support@lobstral-store.com`) and support hours, replacing the normal input controls and typing indicator; include a "Try Again" button that resets `isEmergencyMode` and `consecutiveFailures` to allow recovery

**Checkpoint**: US3 fully functional — watchdog fires, failure counter increments, emergency UI appears after threshold is met and can recover.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final hardening, cleanup, and validation across all user stories.

- [x] T019 [P] Audit all message bubble render paths in `apps/web/app/chat/page.tsx` to confirm that `{msg.text}` and streaming tokens are rendered as plain React text nodes (not `dangerouslySetInnerHTML`) — add a code comment documenting the XSS-prevention rationale
- [x] T020 [P] Reset `consecutiveFailures` counter and `isEmergencyMode` flag in the `handleNewChat()` function in `apps/web/app/chat/page.tsx` so a new session starts clean
- [x] T021 Run `pnpm build` from the repo root to validate TypeScript compilation for both `apps/api` and `apps/web` with zero type errors
- [x] T022 Perform a manual end-to-end walkthrough using the steps in `specs/003-chatbot-resiliency/quickstart.md` to verify all three user story acceptance scenarios pass

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — **BLOCKS all user stories**
- **US1 (Phase 3)**: Depends on Phase 2 completion — no dependency on US2 or US3
- **US2 (Phase 4)**: Depends on Phase 2 completion — no dependency on US1 or US3
- **US3 (Phase 5)**: Depends on Phase 2 completion — no dependency on US1 or US2
- **Polish (Phase 6)**: Depends on all desired user stories being complete

### User Story Dependencies

- **US1 (P1)**: Can start immediately after Foundational — independent
- **US2 (P2)**: Can start immediately after Foundational — independent (T014 is a verification, not a new implementation)
- **US3 (P3)**: Can start immediately after Foundational — independent

### Within Each User Story

- T007 → T008 → T009 → T010 (sequential within US1, each step builds on the previous)
- T011, T012, T013 can run in parallel (different concerns within US2); T014 is a verification step
- T015 → T016, T017 (T016 and T017 can be done in parallel after T015) → T018

### Parallel Opportunities

- T003 and T004 can run in parallel (different functions in `llm.ts`)
- T004 and T005 can run in parallel (different files: `llm.ts` vs `chat.ts`)
- Once Phase 2 is complete, US1, US2, and US3 can all be worked on simultaneously
- T019 and T020 (Polish phase) can run in parallel

---

## Parallel Example: Phase 2 Foundational

```text
# T003 and T004 can start at the same time (different functions in llm.ts):
Task: "Refactor prompt injection defence in apps/api/src/lib/llm.ts"         → T003
Task: "Add generateReplyStream() in apps/api/src/lib/llm.ts"                 → T004

# Once T004 is complete, T005 and T006 can run together:
Task: "Replace POST /chat/message with SSE in apps/api/src/routes/chat.ts"   → T005
Task: "Update Next.js proxy to forward stream in apps/web/.../route.ts"      → T006
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001–T002)
2. Complete Phase 2: Foundational (T003–T006) — **CRITICAL, blocks all stories**
3. Complete Phase 3: User Story 1 (T007–T010)
4. **STOP and VALIDATE**: Click a quick reply chip, verify streaming works end-to-end
5. Demo streaming chat — already a huge UX win

### Incremental Delivery

1. Setup + Foundational → Streaming backend ready
2. US1 → Token-by-token streaming UI + auto-submitting quick replies (MVP)
3. US2 → Input hardening + concurrency defense
4. US3 → Watchdog timer + emergency fallback UI
5. Polish → Final TypeScript validation + manual walkthrough

### Parallel Team Strategy

With two developers after Phase 2:

- **Dev A**: US1 (streaming UI — `apps/web/app/chat/page.tsx`)
- **Dev B**: US2 (input validation — `apps/web/app/chat/page.tsx` + `apps/api/src/routes/chat.ts`)
- US3 follows once either developer finishes their story

---

## Notes

- [P] tasks operate on different files or functions with no cross-dependencies
- [Story] labels map each task to its user story for full traceability
- The streaming refactor (Phase 2) is the highest-risk change — validate T005 and T006 thoroughly before moving to user story phases
- Avoid using `dangerouslySetInnerHTML` anywhere in the chat page — plain React text nodes handle all XSS defense automatically
- Commit after each phase checkpoint to enable easy rollback
