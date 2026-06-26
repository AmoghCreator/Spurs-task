# API Contracts: SSE Message Streaming

This document defines the interface contract for the Server-Sent Events (SSE) streaming endpoint.

---

## 1. POST /chat/message

Initiates a conversation turn and returns a text stream of the AI's response in real-time.

### Request Headers
- `Content-Type: application/json`

### Request Body
```json
{
  "message": "Hello, Lobstral Store!",
  "sessionId": "b48f98c4-ecb4-4ef0-9e5b-38abde110c12"
}
```
*Note:* `sessionId` is optional. If not provided, the server will generate a new session UUID and include it in the stream payload.

---

## 2. Response Contract (Server-Sent Events)

### Response Headers
- `Content-Type: text/event-stream`
- `Cache-Control: no-cache, no-transform`
- `Connection: keep-alive`

### Stream Payload Event Format
The response stream yields SSE events of type `message` containing a JSON payload with a `token` (current text chunk) and the active `sessionId`.

```text
data: {"token": "Hi", "sessionId": "b48f98c4-ecb4-4ef0-9e5b-38abde110c12"}

data: {"token": " there", "sessionId": "b48f98c4-ecb4-4ef0-9e5b-38abde110c12"}

data: {"token": "!", "sessionId": "b48f98c4-ecb4-4ef0-9e5b-38abde110c12"}

data: [DONE]
```

### Protocol Fields
- **`token`** (string): The newly generated word or text fragment.
- **`sessionId`** (string): The active UUID for the current session.
- **`[DONE]`** (marker): A literal termination string indicates the stream has ended successfully and is ready to be closed.

---

## 3. Error Contract (Non-SSE)

If validation or processing fails before the stream can be initialized, standard HTTP status codes and JSON are returned.

### Oversized Payload (HTTP 400)
```json
{
  "error": "MessageTooLong"
}
```

### Empty Message (HTTP 400)
```json
{
  "error": "MessageCannotBeEmpty"
}
```

### Server / Database Error (HTTP 500)
```json
{
  "error": "DatabaseError"
}
```
