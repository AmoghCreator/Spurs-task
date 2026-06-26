import { Context } from "hono";
import { BaseChannel, ChannelRequest } from "./BaseChannel.js";

export class WhatsAppChannel extends BaseChannel {
  readonly name = "whatsapp";

  async parseRequest(c: Context): Promise<ChannelRequest> {
    const body = await c.req.json().catch(() => ({})) as any;
    
    // Extract incoming WhatsApp message (standard Twilio/WhatsApp API webhook structure)
    const incomingMessage = body?.messages?.[0];
    const message = incomingMessage?.text?.body;
    const sessionId = incomingMessage?.from; // sender identifier, e.g. phone number

    if (typeof message !== "string" || !message.trim()) {
      throw new Error("WhatsAppMessageCannotBeEmpty");
    }

    if (typeof sessionId !== "string" || !sessionId.trim()) {
      throw new Error("WhatsAppSessionIdRequired");
    }

    return {
      message: message.trim(),
      sessionId: sessionId.trim(),
    };
  }

  async sendResponse(
    c: Context,
    sessionId: string,
    tokenStream: AsyncGenerator<string, void, unknown>
  ): Promise<Response> {
    // 1. Consume the token stream in the background (non-blocking)
    (async () => {
      let fullReply = "";
      for await (const token of tokenStream) {
        fullReply += token;
      }
      
      // 2. Mock send the compiled message to WhatsApp's API
      await this.sendWhatsAppMessage(sessionId, fullReply);
    })().catch((err) => {
      console.error("[WhatsAppChannel] Failed to send async reply:", err);
    });

    // 3. Respond with 202 Accepted immediately to satisfy webhook response time
    return c.json({ status: "accepted" }, 202);
  }

  private async sendWhatsAppMessage(to: string, text: string): Promise<void> {
    console.log(`[WhatsAppChannel API Mock] Sending message to ${to}: ${text}`);
    // Real implementation: call Facebook Graph / Twilio API
  }
}
