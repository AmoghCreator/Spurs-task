import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

export const chatConversations = sqliteTable("chat_conversations", {
  id: text("id").primaryKey(),
  channelOrigin: text("channel_origin").notNull().default("web"),
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
