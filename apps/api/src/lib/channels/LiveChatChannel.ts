import { Context } from "hono";
import { streamSSE } from "hono/streaming";
import { BaseChannel, ChannelRequest } from "./BaseChannel.js";

export class LiveChatChannel extends BaseChannel {
  readonly name = "web";

  async parseRequest(c: Context): Promise<ChannelRequest> {
    const body = await c.req.json().catch(() => ({})) as Record<string, unknown>;
    const { message, sessionId } = body;

    // Validate: non-empty string
    if (typeof message !== "string" || !message.trim()) {
      throw new Error("MessageCannotBeEmpty");
    }

    // Validate: length cap
    if (message.length > 2000) {
      throw new Error("MessageTooLong");
    }

    // Resolve or generate session UUID
    const sessionUUID =
      typeof sessionId === "string" && sessionId.trim()
        ? sessionId.trim()
        : crypto.randomUUID();

    return {
      message: message.trim(),
      sessionId: sessionUUID,
    };
  }

  async sendResponse(
    c: Context,
    sessionId: string,
    tokenStream: AsyncGenerator<string, void, unknown>
  ): Promise<Response> {
    return streamSSE(c, async (stream) => {
      const controller = new AbortController();
      stream.onAbort(() => {
        controller.abort();
      });

      try {
        for await (const token of tokenStream) {
          if (controller.signal.aborted) {
            break;
          }
          await stream.writeSSE({
            data: JSON.stringify({ token, sessionId }),
          });
        }
      } catch (err) {
        console.error("[LiveChatChannel] Streaming failed:", err);
      } finally {
        await stream.writeSSE({ data: "[DONE]" });
      }
    });
  }
}
