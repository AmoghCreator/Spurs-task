import { Hono } from "hono";
import { orchestrator } from "../lib/orchestrator.js";
import { LiveChatChannel } from "../lib/channels/LiveChatChannel.js";
import { WhatsAppChannel } from "../lib/channels/WhatsAppChannel.js";

export const chat = new Hono();

const liveChatChannel = new LiveChatChannel();
const whatsappChannel = new WhatsAppChannel();

// ── POST /chat/message (Web Live Chat) ────────────────────────────────────────
chat.post("/message", async (c) => {
  try {
    const { message, sessionId } = await liveChatChannel.parseRequest(c);
    
    // Get streaming response from Orchestrator
    const tokenStream = orchestrator.streamReply(
      liveChatChannel.name,
      sessionId,
      message,
      c.req.raw.signal
    );

    // Stream response back via channel provider
    return await liveChatChannel.sendResponse(c, sessionId, tokenStream);
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : "InvalidRequest";
    return c.json({ error: errMsg }, 400);
  }
});

// ── POST /chat/whatsapp/webhook (WhatsApp Webhook) ──────────────────────────
chat.post("/whatsapp/webhook", async (c) => {
  try {
    const { message, sessionId } = await whatsappChannel.parseRequest(c);

    // Get response from Orchestrator (without AbortSignal since webhooks are async/non-blocking)
    const tokenStream = orchestrator.streamReply(
      whatsappChannel.name,
      sessionId,
      message
    );

    // Respond immediately and handle message processing asynchronously
    return await whatsappChannel.sendResponse(c, sessionId, tokenStream);
  } catch (err: any) {
    const errMsg = err instanceof Error ? err.message : "InvalidRequest";
    return c.json({ error: errMsg }, 400);
  }
});

// ── GET /chat/history/:sessionId ──────────────────────────────────────────────
chat.get("/history/:sessionId", async (c) => {
  const sessionId = c.req.param("sessionId");

  try {
    const messages = await orchestrator.getHistory(sessionId);
    return c.json({ messages });
  } catch (err) {
    console.error("[chat] Failed to fetch history:", err);
    return c.json({ error: "DatabaseError" }, 500);
  }
});

