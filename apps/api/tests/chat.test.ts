import { vi, describe, it, expect, beforeAll } from "vitest";
import { app } from "../src/index.js";

// Mock the LLM to avoid real API calls in tests
vi.mock("../src/lib/llm.js", () => ({
  generateReply: vi
    .fn()
    .mockResolvedValue(
      "Hello! I'm your Lobstral support agent. How can I help you today?"
    ),
}));

describe("Chat API Routes", () => {
  // ── Validation ────────────────────────────────────────────────────────────

  it("POST /chat/message → 400 when message is empty string", async () => {
    const res = await app.request("/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "" }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("MessageCannotBeEmpty");
  });

  it("POST /chat/message → 400 when message is whitespace only", async () => {
    const res = await app.request("/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "   " }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("MessageCannotBeEmpty");
  });

  it("POST /chat/message → 400 when message exceeds 2000 chars", async () => {
    const res = await app.request("/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "x".repeat(2001) }),
    });

    expect(res.status).toBe(400);
    const data = (await res.json()) as { error: string };
    expect(data.error).toBe("MessageTooLong");
  });

  it("POST /chat/message → 400 when body is not valid JSON", async () => {
    const res = await app.request("/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json",
    });

    expect(res.status).toBe(400);
  });

  // ── Happy path ────────────────────────────────────────────────────────────

  it("POST /chat/message → 200 with reply and sessionId", async () => {
    const sessionId = crypto.randomUUID();
    const res = await app.request("/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "What are your shipping rates?", sessionId }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { reply: string; sessionId: string };
    expect(typeof data.reply).toBe("string");
    expect(data.reply.length).toBeGreaterThan(0);
    expect(data.sessionId).toBe(sessionId);
  });

  it("POST /chat/message → generates a new sessionId when none provided", async () => {
    const res = await app.request("/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Hello" }),
    });

    expect(res.status).toBe(200);
    const data = (await res.json()) as { reply: string; sessionId: string };
    expect(typeof data.sessionId).toBe("string");
    expect(data.sessionId.length).toBeGreaterThan(0);
  });

  // ── History ───────────────────────────────────────────────────────────────

  it("GET /chat/history/:sessionId → 2 messages after one exchange", async () => {
    const sessionId = crypto.randomUUID();

    // Send one message
    const postRes = await app.request("/chat/message", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Do you ship internationally?", sessionId }),
    });
    expect(postRes.status).toBe(200);

    // Fetch history
    const histRes = await app.request(`/chat/history/${sessionId}`);
    expect(histRes.status).toBe(200);

    const hist = (await histRes.json()) as {
      messages: { id: string; sender: string; text: string }[];
    };

    expect(Array.isArray(hist.messages)).toBe(true);
    expect(hist.messages).toHaveLength(2);
    expect(hist.messages[0].sender).toBe("user");
    expect(hist.messages[0].text).toBe("Do you ship internationally?");
    expect(hist.messages[1].sender).toBe("ai");
  });

  it("GET /chat/history/:sessionId → empty array for unknown session", async () => {
    const res = await app.request(`/chat/history/${crypto.randomUUID()}`);
    expect(res.status).toBe(200);
    const data = (await res.json()) as { messages: unknown[] };
    expect(data.messages).toHaveLength(0);
  });
});
