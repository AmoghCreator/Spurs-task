import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { eq, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { chatConversations, chatMessages } from "../db/schema.js";
import { generateReplyStream } from "../lib/llm.js";

export const chat = new Hono();

// ── POST /chat/message ────────────────────────────────────────────────────────
chat.post("/message", async (c) => {
  // Gracefully handle malformed JSON
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
  const { message, sessionId } = body;

  // Validate: non-empty string
  if (typeof message !== "string" || !message.trim()) {
    return c.json({ error: "MessageCannotBeEmpty" }, 400);
  }

  // Validate: length cap
  if (message.length > 2000) {
    return c.json({ error: "MessageTooLong" }, 400);
  }

  // Resolve or generate session UUID
  const sessionUUID =
    typeof sessionId === "string" && sessionId.trim()
      ? sessionId.trim()
      : crypto.randomUUID();

  try {
    // 1. Upsert conversation row
    db.insert(chatConversations)
      .values({ id: sessionUUID })
      .onConflictDoNothing()
      .run();

    // 2. Persist user message
    db.insert(chatMessages)
      .values({
        id: crypto.randomUUID(),
        conversationId: sessionUUID,
        sender: "user",
        text: message.trim(),
      })
      .run();

    // 3. Fetch last 10 messages for context
    const historyRows = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, sessionUUID))
      .orderBy(asc(chatMessages.timestamp))
      .limit(10)
      .all();

    const history = historyRows.map((r) => ({
      sender: r.sender as "user" | "ai",
      text: r.text,
    }));

    // 4. Return SSE stream
    return streamSSE(c, async (stream) => {
      const controller = new AbortController();
      stream.onAbort(() => {
        controller.abort();
      });

      let fullReply = "";
      try {
        const tokenStream = generateReplyStream(history, message.trim(), controller.signal);
        for await (const token of tokenStream) {
          fullReply += token;
          await stream.writeSSE({
            data: JSON.stringify({ token, sessionId: sessionUUID }),
          });
        }
      } catch (err) {
        console.error("[chat] Streaming failed:", err);
      } finally {
        await stream.writeSSE({ data: "[DONE]" });

        if (fullReply.trim()) {
          try {
            // 5. Persist AI reply
            db.insert(chatMessages)
              .values({
                id: crypto.randomUUID(),
                conversationId: sessionUUID,
                sender: "ai",
                text: fullReply,
              })
              .run();

            // 6. Update conversation timestamp
            db.update(chatConversations)
              .set({ updatedAt: new Date() })
              .where(eq(chatConversations.id, sessionUUID))
              .run();
          } catch (dbErr) {
            console.error("[chat] Failed to save AI reply:", dbErr);
          }
        }
      }
    });
  } catch (dbErr) {
    console.error("[chat] Database operation failed:", dbErr);
    return c.json({ error: "DatabaseError" }, 500);
  }
});

// ── GET /chat/history/:sessionId ──────────────────────────────────────────────
chat.get("/history/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  try {
    const messages = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, sessionId))
      .orderBy(asc(chatMessages.timestamp))
      .all();

    return c.json({
      messages: messages.map((m) => ({
        id: m.id,
        sender: m.sender,
        text: m.text,
        timestamp: m.timestamp,
      })),
    });
  } catch (err) {
    console.error("[chat] Failed to fetch history:", err);
    return c.json({ error: "DatabaseError" }, 500);
  }
});
