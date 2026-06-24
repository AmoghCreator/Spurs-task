"use client";

import { useState, useEffect, useRef, FormEvent } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  timestamp?: Date | null;
}

// ── Constants ────────────────────────────────────────────────────────────────
const SESSION_KEY = "chat_session_id";

// ── Component ────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // On mount: restore session and fetch history
  useEffect(() => {
    const stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return;
    setSessionId(stored);

    fetch(`/api/chat/history/${stored}`)
      .then((r) => r.json())
      .then((data: { messages?: Message[]; error?: string }) => {
        if (data.messages && data.messages.length > 0) {
          setMessages(data.messages);
        }
      })
      .catch((err) => {
        console.error("[chat] Failed to load history:", err);
      });
  }, []);

  // Focus input on load
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // ── Handlers ────────────────────────────────────────────────────────────────
  async function handleSendMessage(e: FormEvent) {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || isLoading) return;

    setInputValue("");
    setError(null);
    setIsLoading(true);

    // Optimistic user bubble
    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text,
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
      });

      const data = (await res.json()) as {
        reply?: string;
        sessionId?: string;
        error?: string;
      };

      if (!res.ok || data.error) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }

      // Persist session
      if (data.sessionId) {
        setSessionId(data.sessionId);
        localStorage.setItem(SESSION_KEY, data.sessionId);
      }

      // AI reply bubble
      const aiMsg: Message = {
        id: crypto.randomUUID(),
        sender: "ai",
        text: data.reply!,
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err: unknown) {
      console.error("[chat] Send failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleNewChat() {
    localStorage.removeItem(SESSION_KEY);
    setSessionId(null);
    setMessages([]);
    setError(null);
    setInputValue("");
    inputRef.current?.focus();
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={s.page}>
      {/* Background blobs */}
      <div style={s.blob1} />
      <div style={s.blob2} />

      <div style={s.card}>
        {/* ── Header ── */}
        <header style={s.header}>
          <div style={s.headerLeft}>
            <div style={s.avatarWrap}>
              <span style={{ fontSize: "22px" }}>🤖</span>
              <span style={s.activeDot} />
            </div>
            <div>
              <p style={s.agentName}>Lobstral Support</p>
              <p style={s.agentStatus}>Online · AI Agent</p>
            </div>
          </div>
          <button style={s.newChatBtn} onClick={handleNewChat} type="button">
            New Chat
          </button>
        </header>

        {/* ── Error Banner ── */}
        {error && (
          <div style={s.errorBanner}>
            <span>⚠ {error}</span>
            <button style={s.closeBtn} onClick={() => setError(null)} type="button">
              ×
            </button>
          </div>
        )}

        {/* ── Messages ── */}
        <div style={s.messageArea}>
          {messages.length === 0 && !isLoading && (
            <div style={s.emptyState}>
              <p style={s.emptyTitle}>👋 Hi there!</p>
              <p style={s.emptyText}>
                Ask me anything about shipping, returns, or support hours.
              </p>
              <div style={s.suggestionRow}>
                {["Shipping to USA?", "Return policy?", "Support hours?"].map((q) => (
                  <button
                    key={q}
                    style={s.suggestionChip}
                    onClick={() => {
                      setInputValue(q);
                      inputRef.current?.focus();
                    }}
                    type="button"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                style={{
                  ...s.messageRow,
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  alignSelf: isUser ? "flex-end" : "flex-start",
                }}
              >
                {!isUser && <span style={s.msgAvatar}>🤖</span>}
                <div
                  style={{
                    ...s.bubble,
                    background: isUser
                      ? "linear-gradient(135deg, #3b82f6, #2563eb)"
                      : "rgba(30, 41, 59, 0.85)",
                    borderBottomLeftRadius: isUser ? "14px" : "4px",
                    borderBottomRightRadius: isUser ? "4px" : "14px",
                    boxShadow: isUser
                      ? "0 4px 16px rgba(59,130,246,0.3)"
                      : "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  <p style={s.bubbleText}>{msg.text}</p>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && (
            <div style={{ ...s.messageRow, justifyContent: "flex-start", alignSelf: "flex-start" }}>
              <span style={s.msgAvatar}>🤖</span>
              <div style={s.typingBubble}>
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span
                    key={i}
                    style={{
                      ...s.typingDot,
                      animationDelay: `${delay}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── Input ── */}
        <form style={s.inputRow} onSubmit={handleSendMessage}>
          <input
            ref={inputRef}
            style={s.input}
            type="text"
            placeholder="Ask about shipping, returns, support hours…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            disabled={isLoading}
            maxLength={2100}
            autoComplete="off"
            spellCheck={false}
          />
          <button
            style={{
              ...s.sendBtn,
              background:
                isLoading || !inputValue.trim()
                  ? "#334155"
                  : "linear-gradient(135deg, #3b82f6, #6366f1)",
              cursor: isLoading || !inputValue.trim() ? "not-allowed" : "pointer",
              boxShadow:
                !isLoading && inputValue.trim()
                  ? "0 4px 14px rgba(99,102,241,0.4)"
                  : "none",
            }}
            type="submit"
            disabled={isLoading || !inputValue.trim()}
            aria-label="Send message"
          >
            ➔
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "100vh",
    background: "radial-gradient(ellipse at 20% 50%, #0d1729 0%, #080c14 60%)",
    padding: "16px",
    overflow: "hidden",
    fontFamily: "var(--font-outfit, system-ui, sans-serif)",
  },
  blob1: {
    position: "absolute",
    top: "-15%",
    left: "-10%",
    width: "45vw",
    height: "45vw",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(59,130,246,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  blob2: {
    position: "absolute",
    bottom: "-15%",
    right: "-10%",
    width: "45vw",
    height: "45vw",
    borderRadius: "50%",
    background:
      "radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)",
    pointerEvents: "none",
    zIndex: 0,
  },
  card: {
    position: "relative",
    zIndex: 1,
    display: "flex",
    flexDirection: "column",
    width: "100%",
    maxWidth: "620px",
    height: "82vh",
    maxHeight: "820px",
    background: "rgba(10, 16, 30, 0.72)",
    border: "1px solid rgba(255,255,255,0.07)",
    borderRadius: "20px",
    boxShadow:
      "0 25px 50px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.06)",
    backdropFilter: "blur(20px)",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(15,23,42,0.5)",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  avatarWrap: {
    position: "relative",
    width: "42px",
    height: "42px",
    borderRadius: "50%",
    background: "rgba(59,130,246,0.15)",
    border: "1px solid rgba(59,130,246,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  activeDot: {
    position: "absolute",
    bottom: "1px",
    right: "1px",
    width: "11px",
    height: "11px",
    borderRadius: "50%",
    background: "#10b981",
    border: "2px solid #080c14",
    boxShadow: "0 0 8px rgba(16,185,129,0.8)",
  },
  agentName: {
    fontSize: "15px",
    fontWeight: 600,
    color: "#f1f5f9",
    margin: 0,
  },
  agentStatus: {
    fontSize: "11px",
    color: "#64748b",
    margin: 0,
    marginTop: "1px",
  },
  newChatBtn: {
    background: "none",
    border: "1px solid rgba(255,255,255,0.1)",
    borderRadius: "8px",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: 500,
    padding: "6px 14px",
    cursor: "pointer",
    transition: "all 0.2s",
    fontFamily: "inherit",
  },
  errorBanner: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(239,68,68,0.12)",
    borderBottom: "1px solid rgba(239,68,68,0.25)",
    color: "#fca5a5",
    padding: "8px 18px",
    fontSize: "13px",
    flexShrink: 0,
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#fca5a5",
    fontSize: "18px",
    cursor: "pointer",
    lineHeight: 1,
    padding: "0 2px",
  },
  messageArea: {
    flex: 1,
    overflowY: "auto",
    padding: "20px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    flex: 1,
    gap: "10px",
    textAlign: "center",
    paddingTop: "40px",
  },
  emptyTitle: {
    fontSize: "22px",
    fontWeight: 600,
    color: "#f1f5f9",
    margin: 0,
  },
  emptyText: {
    fontSize: "14px",
    color: "#64748b",
    maxWidth: "280px",
    lineHeight: 1.6,
    margin: 0,
  },
  suggestionRow: {
    display: "flex",
    gap: "8px",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: "8px",
  },
  suggestionChip: {
    background: "rgba(59,130,246,0.1)",
    border: "1px solid rgba(59,130,246,0.25)",
    borderRadius: "20px",
    color: "#93c5fd",
    fontSize: "12px",
    fontWeight: 500,
    padding: "6px 14px",
    cursor: "pointer",
    fontFamily: "inherit",
    transition: "all 0.2s",
  },
  messageRow: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    maxWidth: "84%",
  },
  msgAvatar: {
    fontSize: "16px",
    flexShrink: 0,
    marginBottom: "2px",
    width: "28px",
    height: "28px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(255,255,255,0.04)",
    borderRadius: "50%",
    border: "1px solid rgba(255,255,255,0.08)",
  },
  bubble: {
    padding: "10px 14px",
    borderRadius: "14px",
    maxWidth: "100%",
    wordBreak: "break-word",
    transition: "opacity 0.15s ease",
  },
  bubbleText: {
    margin: 0,
    fontSize: "14px",
    lineHeight: "1.55",
    color: "#f1f5f9",
    whiteSpace: "pre-wrap",
  },
  typingBubble: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    background: "rgba(30,41,59,0.85)",
    padding: "12px 16px",
    borderRadius: "14px",
    borderBottomLeftRadius: "4px",
  },
  typingDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    background: "#94a3b8",
    display: "inline-block",
    animation: "typingBounce 1.4s infinite ease-in-out both",
  },
  inputRow: {
    display: "flex",
    gap: "10px",
    padding: "14px 18px",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    background: "rgba(10,16,30,0.5)",
    flexShrink: 0,
  },
  input: {
    flex: 1,
    background: "rgba(15,23,42,0.8)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: "12px",
    color: "#f1f5f9",
    padding: "12px 16px",
    fontSize: "14px",
    outline: "none",
    fontFamily: "inherit",
    transition: "border-color 0.2s",
  },
  sendBtn: {
    flexShrink: 0,
    width: "46px",
    height: "46px",
    borderRadius: "12px",
    border: "none",
    color: "#fff",
    fontSize: "18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    fontFamily: "inherit",
  },
};
