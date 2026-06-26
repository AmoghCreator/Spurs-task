import { eq, asc } from "drizzle-orm";
import { db } from "../db/client.js";
import { chatConversations, chatMessages } from "../db/schema.js";
import { generateReplyStream } from "./llm.js";

export const orchestrator = {
  /**
   * Orchestrates the receipt of a user message.
   * 1. Inserts/registers the session with its originating channel.
   * 2. Saves the user's message to the database.
   * 3. Fetches the last 10 messages of history.
   * 4. Queries the LLM stream.
   * 5. Returns a generator yielding tokens, and saves the completed AI reply upon exit.
   */
  async *streamReply(
    channelOrigin: string,
    sessionId: string,
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    // 1. Upsert conversation row
    db.insert(chatConversations)
      .values({
        id: sessionId,
        channelOrigin: channelOrigin,
      })
      .onConflictDoNothing()
      .run();

    // 2. Persist user message
    db.insert(chatMessages)
      .values({
        id: crypto.randomUUID(),
        conversationId: sessionId,
        sender: "user",
        text: message.trim(),
      })
      .run();

    // 3. Fetch last 10 messages for context
    const historyRows = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, sessionId))
      .orderBy(asc(chatMessages.timestamp))
      .limit(10)
      .all();

    const history = historyRows.map((r) => ({
      sender: r.sender as "user" | "ai",
      text: r.text,
    }));

    let fullReply = "";
    try {
      const tokenStream = generateReplyStream(
        history,
        message.trim(),
        signal || new AbortController().signal
      );
      for await (const token of tokenStream) {
        fullReply += token;
        yield token;
      }
    } finally {
      if (fullReply.trim()) {
        try {
          // 4. Persist AI reply
          db.insert(chatMessages)
            .values({
              id: crypto.randomUUID(),
              conversationId: sessionId,
              sender: "ai",
              text: fullReply,
            })
            .run();

          // 5. Update conversation timestamp
          db.update(chatConversations)
            .set({ updatedAt: new Date() })
            .where(eq(chatConversations.id, sessionId))
            .run();
        } catch (dbErr) {
          console.error("[orchestrator] Failed to save AI reply:", dbErr);
        }
      }
    }
  },

  /**
   * Retrieves conversation history for a given session.
   */
  async getHistory(sessionId: string) {
    const messages = db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.conversationId, sessionId))
      .orderBy(asc(chatMessages.timestamp))
      .all();

    return messages.map((m) => ({
      id: m.id,
      sender: m.sender,
      text: m.text,
      timestamp: m.timestamp,
    }));
  }
};
export type Orchestrator = typeof orchestrator;
