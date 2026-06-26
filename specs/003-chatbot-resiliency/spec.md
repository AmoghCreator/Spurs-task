# Feature Specification: Chatbot Production Resiliency & Idiot-Proofing

**Feature Branch**: `003-chatbot-resiliency`  
**Created**: 2026-06-26  
**Status**: Draft  
**Input**: User description: "need to idiot proof our chatbot, here are some ideas"

## Overview

This specification defines the production resiliency, defense mechanisms, and user experience enhancements for the Spur Live Chat widget. The objective is to secure the platform against adversarial interactions, spotty network environments, resource exhaustion, and prompt injections, while optimizing perceived performance and ensuring graceful degradation.

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Real-Time Streaming & Interaction Triggers (Priority: P1)

Users see AI responses stream in real-time chunk-by-chunk and can use quick replies to start conversations instantly.

**Why this priority**: Core user experience enhancements that optimize perceived performance and reduce cold-start friction.

**Independent Test**: Navigate to the chat page, click a quick-reply chip, and verify that the message is automatically sent and the AI response streams token-by-token instead of waiting for the full response.

**Acceptance Scenarios**:

1. **Given** a user opens the chat page, **When** the page loads, **Then** contextual option chips (quick replies) are displayed above the text input bar representing seeded domain rules.
2. **Given** the option chips are displayed, **When** the user clicks a chip, **Then** the message is populated and sent immediately.
3. **Given** a message is submitted, **When** the server starts generating a response, **Then** the message bubble updates dynamically token-by-token as chunks are received.

---

### User Story 2 - Defending Against Input Floods & Oversized Payloads (Priority: P2)

The system protects itself against rapid multiple clicks, hotkey hammering, and extremely large copy-pasted text inputs.

**Why this priority**: Prevents race conditions, state corruption, UI rendering issues, and backend/LLM context-window exhaustion.

**Independent Test**: Double-click the submit button rapidly, or paste a 50,000-character prompt, and verify that the system blocks duplicate submissions and rejects oversized inputs cleanly.

**Acceptance Scenarios**:

1. **Given** a user submits a message, **When** the submission action is triggered, **Then** the input text area and send button are disabled within milliseconds, and the message content is bound to a unique client-side message container.
2. **Given** the user attempts to submit a message, **When** the message exceeds the maximum allowed character limit (2000 characters), **Then** the system blocks submission at the DOM level and shows a validation error message, and the backend rejects it with an HTTP validation error if bypassed.

---

### User Story 3 - Consecutive Failure Fallback & Hanging Connection Recovery (Priority: P3)

The system detects hanging connections and repeated connection failures, automatically transitioning to a secure fallback UI.

**Why this priority**: Prevents the UI from freezing indefinitely during network dropouts or backend service outages and guides the user to alternative support channels.

**Independent Test**: Simulate a mid-stream network disconnection or API failure, and verify that the connection times out and that after 2 consecutive failures the chat UI switches to the emergency fallback display.

**Acceptance Scenarios**:

1. **Given** an active response stream is in progress, **When** no new response chunks arrive within a sliding window of 5–8 seconds, **Then** the system aborts the stream and records a communication failure.
2. **Given** the system tracks consecutive failures, **When** the count of consecutive failures reaches the threshold of 2, **Then** further automated retry attempts are suppressed, and the normal input controls/loading states are replaced with a high-visibility support contact block.
3. **Given** the system is tracking failures, **When** a single message interaction succeeds completely, **Then** the failure counter is reset to 0.

---

### Edge Cases

- **User closes or reloads tab mid-generation**: The backend detects the disconnection, stops the current stream, and aborts the upstream LLM generation call immediately.
- **Malformed script tag/injection payload in user message**: The frontend sanitizes the text before rendering to ensure it is displayed as plain text and cannot be executed as HTML/script.
- **LLM response contains instructions to bypass rules**: The system prompt isolates user input to ensure the LLM treats it as literal text rather than executable instructions.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST stream AI responses token-by-token to the client interface using persistent server-to-client channels (e.g., Server-Sent Events).
- **FR-002**: System MUST render contextual option chips (quick replies) above the input bar representing seeded domain constraints. Clicking a chip must populate and submit the message.
- **FR-003**: System MUST isolate messaging channel ingestion from LLM orchestration and storage, allowing additional channel pipelines to be integrated without modifying storage/model code.
- **FR-004**: System MUST treat conversation sessions as independent containers, separating session metadata and origins from individual message records.
- **FR-005**: System MUST block user input controls instantly upon message submission.
- **FR-006**: System MUST bind each message token stream exclusively to a unique client-side identifier to prevent overlapping streaming buffers.
- **FR-007**: System MUST track consecutive communication failures (network dropouts, timeouts, non-200 responses) in a local tracker.
- **FR-008**: System MUST abort the stream and record a failure if no new tokens arrive within a 5-8 second sliding window.
- **FR-009**: System MUST transition to an Emergency UI display (displaying support email and phone number from secure local configuration) when the consecutive failure threshold of 2 is met, suppressing further automatic re-attempts.
- **FR-010**: System MUST reset the consecutive failure tracker to 0 upon a single successful complete message/stream interaction.
- **FR-011**: System MUST enforce a maximum character limit (e.g., 2000 characters) at both the DOM input level and the API routing layer.
- **FR-012**: System MUST monitor connection closures on the backend, immediately aborting upstream LLM requests via abort controllers if the client disconnects.
- **FR-013**: System MUST sanitize all user/AI messages prior to rendering them in the DOM to prevent script execution.
- **FR-014**: System MUST format system prompts to isolate user inputs inside strict boundaries (data tags) and instruct the LLM to treat them strictly as literal data.
- **FR-015**: System MUST document the production resiliency mechanisms and threat analysis in a dedicated section of the primary repository documentation.

### Key Entities

- **Channel Provider**: An abstraction representing a messaging pipeline (e.g., web chat widget, external webhooks). Defines ingestion and dispatch protocols.
- **Conversation Session**: The isolated container holding session metadata, channel origin, and failure tracking state.
- **Message Token Stream**: A real-time stream of message fragments bound to a specific unique client-side message ID.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: AI response tokens begin displaying in the UI within 1 second of submission under normal conditions.
- **SC-002**: Double-clicking or spamming the submit button never spawns concurrent message requests or duplicate database inserts.
- **SC-003**: If a network connection is lost mid-stream, the UI aborts the loading state within 8 seconds and increments the failure counter.
- **SC-004**: Upon the second consecutive connection failure, the interface replaces the input/chat box with the emergency fallback channels UI.
- **SC-005**: Pasting text longer than the character limit is blocked immediately from submission, and the API rejects the request if bypassed.
- **SC-006**: Closing the tab during response generation results in the immediate cancellation of the active upstream LLM API request.
- **SC-007**: Script tags or prompt injection directives in user messages are rendered safely as plain text and do not affect LLM behavior.

## Assumptions

- Predefined quick replies and emergency contact info are loaded from a local layout configuration file.
- The browser environment supports Server-Sent Events or similar persistent stream protocols.
- Abort signals are supported by both the backend platform and the upstream LLM SDK/API client.
