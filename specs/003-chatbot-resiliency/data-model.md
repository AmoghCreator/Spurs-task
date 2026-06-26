# Data Model: Chatbot Resiliency & Context Management

This document defines the schema updates, entities, and logical data models required to support encapsulated context management and provider-pattern channel decoupling.

---

## 1. Schema Changes (SQLite via Drizzle)

To isolate session definitions, store channel origins, and persist custom metadata parameters, we extend the `chat_conversations` table.

```typescript
// apps/api/src/db/schema.ts

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const chatConversations = sqliteTable("chat_conversations", {
  id: text("id").primaryKey(),
  
  // Decoupled Channel Origin (e.g. "web", "whatsapp", "instagram", "facebook")
  channelOrigin: text("channel_origin").notNull().default("web"),
  
  // Serialized JSON for persistent session parameters and custom context
  metadata: text("metadata"), 

  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const chatMessages = sqliteTable("chat_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => chatConversations.id, { onDelete: "cascade" }),
  sender: text("sender", { enum: ["user", "ai"] }).notNull(),
  text: text("text").notNull(),
  timestamp: integer("timestamp", { mode: "timestamp" })
    .notNull()
    .default(sql`(unixepoch())`),
});
```

---

## 2. Entity Specifications

### ChatConversation
Represents an independent session container.
- `id` (text, Primary Key): A unique UUID generated client-side or during external channel webhook ingestion.
- `channelOrigin` (text): Tracks which ingestion pipeline created the session. Restricts conversation retrieval to that specific channel.
- `metadata` (text): Stores key-value parameters (such as user profile details, language preference, or LLM-specific parameters) without affecting message schemas.
- `createdAt` / `updatedAt` (timestamp): Track session age and activity.

### ChatMessage
Represents a single conversation turn.
- `id` (text, Primary Key): Unique message identifier.
- `conversationId` (text, Foreign Key): Links to a conversation. Cascade deletes clean up all message logs when a session is deleted.
- `sender` (text enum): Either `"user"` or `"ai"`.
- `text` (text): Content of the message.
- `timestamp` (timestamp): Accurate sequence timing of when the turn occurred.

---

## 3. Data Integrity & Validation Rules

1. **Session Isolation**: A message query MUST filter strictly by `conversation_id`.
2. **Channel Constraints**: The ingestion router must prevent cross-channel session updates (e.g. WhatsApp webhook cannot append messages to a Web session ID).
3. **Payload Limit**:
   - `chat_messages.text` length must be verified on save to be $\le 2000$ characters.
4. **Referential Integrity**:
   - Every message MUST reference an existing conversation session.
   - Deleting a conversation cascades and deletes all related messages.
