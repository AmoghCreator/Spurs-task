import { Context } from "hono";

export interface ChannelRequest {
  message: string;
  sessionId: string;
}

export abstract class BaseChannel {
  /**
   * The name of the channel (e.g. 'web', 'whatsapp').
   * Corresponds to the channel_origin field in the database.
   */
  abstract readonly name: string;

  /**
   * Parse the incoming HTTP request context and return the message and session identification.
   */
  abstract parseRequest(c: Context): Promise<ChannelRequest>;

  /**
   * Format and send the response stream back to the client/webhook according to channel conventions.
   */
  abstract sendResponse(
    c: Context,
    sessionId: string,
    tokenStream: AsyncGenerator<string, void, unknown>
  ): Promise<Response>;
}
