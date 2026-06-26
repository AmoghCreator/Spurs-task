# Research: Production Resiliency & Streaming Design Decisions

This document details the research, technology choices, and rationales for implementing production-grade resiliency and idiot-proofing in the Lobstral Chat system.

---

## 1. Real-Time Token-by-Token Streaming

### Decision
Implement streaming utilizing **Server-Sent Events (SSE)**. The backend Hono route will use Hono's native streaming capabilities, and the Next.js API route will forward the raw readable stream back to the React client.

### Rationale
- **Low Latency**: Perceived performance is greatly improved since users see text appear within milliseconds instead of waiting for the full 4–5 sentences to finish generating.
- **Simplicity**: Unlike WebSockets, SSE operates over standard HTTP, making it simpler to deploy, route, and configure with typical proxies without managing socket handshakes, heartbeat events, or protocol upgrades.

### Alternatives Considered
- **WebSockets**: Rejected because bidirectionality is not required. The user sends a single HTTP request, and the server streams the response. WebSockets introduce stateful connection overhead on the server.
- **REST Polling**: Rejected due to high latency, overhead of repeated HTTP headers, and unnecessary database polling write/read cycles.

---

## 2. LLM Streaming Integration (Gemini & OpenAI)

### Decision
Use raw `fetch` to query Gemini's `streamGenerateContent` with the query parameter `alt=sse`, and OpenAI's `v1/chat/completions` with `"stream": true`. We will parse the incoming stream chunks as standard Server-Sent Events, extract the text tokens, and format them into a unified SSE format for the client.

### Rationale
- **Zero Additional Dependencies**: Keeps the `api` package size small by utilizing standard web APIs (native `fetch` and `ReadableStream` reader) without relying on heavy official SDKs.
- **Gemini `alt=sse` Parameter**: Google APIs natively support streaming JSON chunks as SSE lines if `alt=sse` is passed. This makes parsing Gemini streams identical to parsing OpenAI SSE lines, allowing a unified stream parser.

### Alternatives Considered
- **Official SDKs (`@google/generative-ai` / `openai`)**: Rejected to avoid dependency bloat and because manual stream parsing is highly straightforward using basic text splitting and JSON decoding.

---

## 3. Mid-Stream Network Drop Watchdog

### Decision
Implement a client-side sliding-window watchdog timer using `setTimeout`. When a stream is initiated, we set a timer for 8 seconds. For every chunk received, the timer is cleared and reset to 8 seconds. If no chunk is received before the timer fires, the client forcibly aborts the connection via `AbortController.abort()`, displays a timeout message, and increments the consecutive failure counter.

### Rationale
- **Catches Silent Dropouts**: A standard browser `fetch` timeout only measures the time to receive the initial headers (TTFB) and does not detect when the connection hangs mid-stream due to spotty mobile networks.
- **Fails Fast**: Ensures that users are not left staring at a blinking typing indicator indefinitely.

### Alternatives Considered
- **TCP Keep-Alives**: Too slow (OS-level timeout is typically minutes).
- **Application-Level Pings**: Overkill for a one-directional short stream.

---

## 4. Multi-Click Submission Flood (Race Conditions)

### Decision
Instantly disable the text input area and submit button in React state (setting `isLoading` to true) at the exact millisecond of the submission event. In addition, assign a unique message UUID to each message container on the client before dispatching, forcing the incoming stream to bind to that ID.

### Rationale
- **Bulletproof Concurrency Control**: Prevents double submission from double clicks or hotkey hammering.
- **State Integrity**: Ensures stream rendering buffers do not intersect destructively even if multiple requests somehow bypass the UI block.

### Alternatives Considered
- **Debouncing**: Standard debouncing is insufficient as it delays the actual submission action, which degrades perceived speed.
- **Throttling**: Still allows parallel requests if the user clicks just outside the throttle window.

---

## 5. Tab Closure Resource Leak (Ghost Client)

### Decision
Register a connection-abort listener on the Hono backend server request. When the client closes the connection (closing tab, reloading page, or navigating away), Hono's `stream` lifecycle detects the closure, triggering `stream.onAbort(...)`. The backend will invoke `abort()` on the `AbortController` associated with the upstream LLM API request.

### Rationale
- **Saves CPU & Money**: Immediately terminates LLM token generation at the provider level, preserving API credits and system resources.
- **Prevents Memory Bloat**: Cleanly releases connection handles instead of leaving orphan HTTP sockets open.

### Alternatives Considered
- **No Action**: Standard behaviour is to let the LLM finish generating the response and discard it. This is highly wasteful and represents a vector for Denial of Service (DoS) attacks.

---

## 6. Prompt Injection & Safe DOM Placement

### Decision
- **DOM Placement**: Render message text safely via standard React JSX text nodes (e.g., `{msg.text}`) which implicitly escape all HTML and JavaScript tags.
- **LLM Directives**: Isolate the user message within XML-style enclosures (e.g., `<user_message>...</user_message>`) in the system prompt. Instruct the LLM explicitly to treat anything inside these tags as literal plain text content, never as commands.

### Rationale
- **Defense-in-Depth**: Secures both the web client runtime (preventing XSS) and the LLM orchestration layer (preventing prompt injection) with clean, robust techniques.

### Alternatives Considered
- **HTML Sanitizers (e.g., DOMPurify)**: Unnecessary since we are displaying messages as plain text, not rich HTML.
- **Regex Keyword Scanning**: Fragile and easily bypassed by sophisticated prompt injections.
