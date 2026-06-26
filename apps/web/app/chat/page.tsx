"use client";

import { useState, useEffect, useRef, FormEvent } from "react";

// ── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  sender: "user" | "ai";
  text: string;
  streamingText?: string;
  timestamp?: Date | null;
}

// ── Constants ────────────────────────────────────────────────────────────────
const HISTORY_KEY = "chat_sessions_history";

const SUGGESTIONS = ["Shipping to USA?", "Return policy?", "Support hours?"];

// ── Component ────────────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inputFocused, setInputFocused] = useState(false);
  const [emojiAnimation, setEmojiAnimation] = useState("wave 0.8s ease-in-out");
  const [consecutiveFailures, setConsecutiveFailures] = useState(0);
  const [isEmergencyMode, setIsEmergencyMode] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageAreaRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to latest message — scoped to the message container only
  useEffect(() => {
    const el = messageAreaRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, isLoading]);

  // On mount: restore session ONLY if present in URL (allows refresh, but doesn't auto-open old sessions on fresh navigation)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlSession = params.get("session");
    if (!urlSession) return;
    setSessionId(urlSession);

    fetch(`/api/chat/history/${urlSession}`)
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

  function handleFailure() {
    setConsecutiveFailures((prev) => {
      const next = prev + 1;
      if (next >= 2) {
        setIsEmergencyMode(true);
      }
      return next;
    });
  }

  function handleSuccess() {
    setConsecutiveFailures(0);
  }

  async function handleSendMessage(e?: FormEvent, textOverride?: string) {
    if (e) e.preventDefault();
    const text = (textOverride !== undefined ? textOverride : inputValue).trim();
    if (!text || isLoading) return;

    setInputValue("");
    setError(null);
    setIsLoading(true);

    const userMsg: Message = {
      id: crypto.randomUUID(),
      sender: "user",
      text,
    };
    const aiMsgId = crypto.randomUUID();
    const initialAiMsg: Message = {
      id: aiMsgId,
      sender: "ai",
      text: "",
      streamingText: "",
    };
    
    setMessages((prev) => [...prev, userMsg, initialAiMsg]);

    const abortController = new AbortController();
    let watchdogTimer: NodeJS.Timeout | undefined;
    
    const resetWatchdog = () => {
      clearTimeout(watchdogTimer);
      watchdogTimer = setTimeout(() => {
        abortController.abort(new Error("Connection timed out."));
      }, 8000);
    };

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: text, sessionId }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        let errData;
        try { errData = await res.json(); } catch { /* ignore */ }
        throw new Error(errData?.error ?? `HTTP ${res.status}`);
      }

      if (!res.body) throw new Error("No response body");

      const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
      let streamFinished = false;
      let finalSessionId = sessionId;

      while (!streamFinished) {
        resetWatchdog();
        const { value, done } = await reader.read();
        if (done) break;

        const lines = value.split("\n");
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6);
            if (dataStr === "[DONE]") {
              streamFinished = true;
              break;
            }
            try {
              const data = JSON.parse(dataStr);
              if (data.sessionId) finalSessionId = data.sessionId;
              if (data.token) {
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === aiMsgId
                      ? { ...m, streamingText: (m.streamingText || "") + data.token }
                      : m
                  )
                );
              }
            } catch (err) {
              // Ignore parse error
            }
          }
        }
      }
      
      clearTimeout(watchdogTimer);

      if (finalSessionId && finalSessionId !== sessionId) {
        setSessionId(finalSessionId);
        window.history.replaceState(null, "", `?session=${finalSessionId}`);
        
        // Save to history array for future "history tab" feature
        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
        if (!history.includes(finalSessionId)) {
          history.push(finalSessionId);
          localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
        }
      }

      // Finalize message text
      setMessages((prev) =>
        prev.map((m) =>
          m.id === aiMsgId
            ? { ...m, text: m.streamingText || "", streamingText: undefined }
            : m
        )
      );

      handleSuccess();
    } catch (err: unknown) {
      clearTimeout(watchdogTimer);
      console.error("[chat] Send failed:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
      // Remove the incomplete AI message on error
      setMessages((prev) => prev.filter((m) => m.id !== aiMsgId));
      handleFailure();
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }

  function handleNewChat() {
    window.history.replaceState(null, "", window.location.pathname);
    setSessionId(null);
    setMessages([]);
    setError(null);
    setInputValue("");
    setEmojiAnimation("wave 0.8s ease-in-out");
    setConsecutiveFailures(0);
    setIsEmergencyMode(false);
    inputRef.current?.focus();
  }

  const canSend = !isLoading && inputValue.trim().length > 0;

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        background: "var(--bg-page)",
        fontFamily: "var(--font-outfit)",
        padding: "16px",
        overflow: "hidden",
        isolation: "isolate",
      }}
    >
      {/* ── Ambient blobs ── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-15%",
          left: "-10%",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          background: "var(--bg-blob-1)",
          pointerEvents: "none",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-15%",
          right: "-10%",
          width: "45vw",
          height: "45vw",
          borderRadius: "50%",
          background: "var(--bg-blob-2)",
          pointerEvents: "none",
        }}
      />

      {/* ── Chat card ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          width: "100%",
          maxWidth: "640px",
          height: "88vh",
          maxHeight: "840px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          borderRadius: "24px",
          boxShadow: "var(--shadow-card)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
          overflow: "hidden",
        }}
      >
        {/* ── Header ── */}
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "14px 20px",
            borderBottom: "1px solid var(--border-header)",
            background: "var(--bg-header)",
            backdropFilter: "blur(12px)",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Avatar with online dot */}
            <div
              style={{
                position: "relative",
                width: "42px",
                height: "42px",
                borderRadius: "50%",
                background: "var(--avatar-bg)",
                border: "1px solid var(--avatar-border)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: "20px",
                flexShrink: 0,
              }}
            >
              🤖
              <span
                aria-hidden="true"
                style={{
                  position: "absolute",
                  bottom: "1px",
                  right: "1px",
                  width: "11px",
                  height: "11px",
                  borderRadius: "50%",
                  background: "var(--dot-online)",
                  border: `2px solid var(--dot-border)`,
                  boxShadow: "0 0 8px rgba(16,185,129,0.7)",
                  animation: "dotPulse 2.5s ease-in-out infinite",
                }}
              />
            </div>

            <div>
              <p
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  margin: 0,
                  letterSpacing: "-0.01em",
                }}
              >
                Mr.Spurs Support
              </p>
              <p
                style={{
                  fontSize: "11px",
                  color: "var(--dot-online)",
                  margin: 0,
                  marginTop: "1px",
                  fontWeight: 600,
                  letterSpacing: "0.02em",
                }}
              >
                Online · AI Agent
              </p>
            </div>
          </div>

          <button
            id="new-chat-btn"
            style={{
              background: "var(--bg-new-btn)",
              border: "1px solid var(--border-btn)",
              borderRadius: "10px",
              color: "var(--text-secondary)",
              fontSize: "12px",
              fontWeight: 600,
              padding: "7px 16px",
              cursor: "pointer",
              transition: "all 0.2s",
              fontFamily: "inherit",
              letterSpacing: "0.01em",
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-primary)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-chip)";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
              (e.currentTarget as HTMLElement).style.borderColor = "var(--border-btn)";
            }}
            onClick={handleNewChat}
            type="button"
          >
            New Chat
          </button>
        </header>

        {/* ── Error Banner ── */}
        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "var(--error-bg)",
              borderBottom: `1px solid var(--error-border)`,
              color: "var(--error-text)",
              padding: "9px 20px",
              fontSize: "13px",
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            <span>⚠ {error}</span>
            <button
              id="dismiss-error-btn"
              style={{
                background: "none",
                border: "none",
                color: "var(--error-text)",
                fontSize: "18px",
                cursor: "pointer",
                lineHeight: 1,
                padding: "0 2px",
                opacity: 0.7,
                transition: "opacity 0.2s",
              }}
              onClick={() => setError(null)}
              type="button"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {/* ── Message Area ── */}
        {!isEmergencyMode ? (
          <div
            ref={messageAreaRef}
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "20px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
          {/* Empty state */}
          {messages.length === 0 && !isLoading && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                flex: 1,
                gap: "12px",
                textAlign: "center",
                paddingTop: "32px",
              }}
            >
              <div
                style={{
                  fontSize: "40px",
                  filter: "drop-shadow(0 0 16px rgba(37,99,235,0.35))",
                  display: "inline-block",
                  transformOrigin: "70% 80%",
                  cursor: "default",
                  animation: emojiAnimation,
                }}
                onMouseEnter={() => {
                  setEmojiAnimation("wave 0.8s ease-in-out");
                }}
                onMouseLeave={() => {
                  setEmojiAnimation("none");
                }}
                onAnimationEnd={() => {
                  setEmojiAnimation("none");
                }}
              >
                👋
              </div>
              <p
                style={{
                  fontSize: "18px",
                  fontWeight: 700,
                  color: "var(--text-primary)",
                  letterSpacing: "-0.01em",
                  margin: 0,
                }}
              >
                Hi there!
              </p>
              <p
                style={{
                  fontSize: "14px",
                  color: "var(--text-secondary)",
                  maxWidth: "280px",
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                Ask me anything about shipping, returns, or support hours.
              </p>

              {/* Suggestion chips */}
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  flexWrap: "wrap",
                  justifyContent: "center",
                  marginTop: "4px",
                }}
              >
                {SUGGESTIONS.map((q) => (
                  <button
                    key={q}
                    style={{
                      background: "var(--bg-chip)",
                      border: "1px solid var(--border-chip)",
                      borderRadius: "100px",
                      color: "var(--text-chip)",
                      fontSize: "13px",
                      fontWeight: 500,
                      padding: "7px 16px",
                      cursor: "pointer",
                      fontFamily: "inherit",
                      transition: "all 0.2s",
                    }}
                    onMouseOver={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "var(--shadow-glow-blue)";
                    }}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
                      (e.currentTarget as HTMLElement).style.boxShadow = "none";
                    }}
                    onClick={() => {
                      handleSendMessage(undefined, q);
                    }}
                    type="button"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            const isEmpty = !isUser && !msg.text && !msg.streamingText;
            if (isEmpty) return null;

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "8px",
                  maxWidth: "84%",
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  justifyContent: isUser ? "flex-end" : "flex-start",
                  animation: "bubbleIn 0.25s ease-out both",
                }}
              >
                {/* AI Avatar */}
                {!isUser && (
                  <div
                    aria-hidden="true"
                    style={{
                      fontSize: "14px",
                      flexShrink: 0,
                      width: "28px",
                      height: "28px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      background: "var(--avatar-bg)",
                      borderRadius: "50%",
                      border: "1px solid var(--avatar-border)",
                      marginBottom: "2px",
                    }}
                  >
                    🤖
                  </div>
                )}

                {/* Bubble */}
                <div
                  style={{
                    padding: "10px 15px",
                    borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                    maxWidth: "100%",
                    wordBreak: "break-word",
                    background: isUser ? "var(--bubble-user-bg)" : "var(--bg-bubble-ai)",
                    boxShadow: isUser
                      ? "var(--shadow-bubble-user)"
                      : "var(--shadow-bubble-ai)",
                    border: isUser ? "none" : "1px solid var(--border-card)",
                  }}
                >
                  {/*
                    XSS Prevention Rationale:
                    By rendering msg.text and msg.streamingText inside standard React text nodes rather than using
                    dangerouslySetInnerHTML, React automatically escapes all HTML entities.
                    This prevents any malicious scripts returned by the LLM (or injected via prompt) from executing.
                  */}
                  <p
                    style={{
                      margin: 0,
                      fontSize: "14px",
                      lineHeight: 1.6,
                      color: isUser ? "#ffffff" : "var(--text-primary)",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.streamingText !== undefined ? msg.streamingText : msg.text}
                  </p>
                </div>
              </div>
            );
          })}

          {/* Typing indicator */}
          {isLoading && messages.length > 0 && messages[messages.length - 1].sender === "ai" && !messages[messages.length - 1].text && !messages[messages.length - 1].streamingText && (
            <div
              aria-label="AI is typing"
              style={{
                display: "flex",
                alignItems: "flex-end",
                gap: "8px",
                alignSelf: "flex-start",
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  fontSize: "14px",
                  width: "28px",
                  height: "28px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "var(--avatar-bg)",
                  borderRadius: "50%",
                  border: "1px solid var(--avatar-border)",
                  flexShrink: 0,
                }}
              >
                🤖
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  background: "var(--bg-bubble-ai)",
                  border: "1px solid var(--border-card)",
                  padding: "12px 16px",
                  borderRadius: "18px 18px 18px 4px",
                  boxShadow: "var(--shadow-bubble-ai)",
                }}
              >
                {[0, 0.2, 0.4].map((delay, i) => (
                  <span
                    key={i}
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      background: "var(--text-muted)",
                      display: "inline-block",
                      animation: `typingBounce 1.4s infinite ease-in-out both`,
                      animationDelay: `${delay}s`,
                    }}
                  />
                ))}
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
          </div>
        ) : (
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "32px 24px",
              textAlign: "center",
              gap: "16px",
              background: "var(--bg-page)",
            }}
          >
            <div style={{ fontSize: "48px" }}>🛠️</div>
            <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: "20px" }}>Chat is currently unavailable</h2>
            <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "14px", lineHeight: 1.5 }}>
              We're having trouble connecting to our live chat right now. 
              <br /><br />
              Please email us at <strong>support@mrspurs-store.com</strong> and we'll get back to you within 24 business hours. Our support hours are Monday to Friday, 9:00 AM – 5:00 PM EST.
            </p>
            <button
              onClick={() => {
                setIsEmergencyMode(false);
                setConsecutiveFailures(0);
                setError(null);
              }}
              style={{
                marginTop: "16px",
                padding: "10px 20px",
                background: "var(--brand-blue)",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                cursor: "pointer",
                fontWeight: 600,
                fontFamily: "inherit",
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── Input Area ── */}
        {!isEmergencyMode && (
        <form
          onSubmit={(e) => handleSendMessage(e)}
          style={{
            display: "flex",
            gap: "10px",
            padding: "14px 18px",
            borderTop: "1px solid var(--border-header)",
            background: "var(--bg-header)",
            flexShrink: 0,
            alignItems: "flex-start",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
            <input
              ref={inputRef}
              id="chat-input"
              style={{
                width: "100%",
                background: "var(--bg-input)",
              border: `1.5px solid ${inputFocused ? "var(--brand-blue)" : "var(--border-input)"}`,
              borderRadius: "14px",
              color: "var(--text-primary)",
              padding: "12px 16px",
              fontSize: "14px",
              outline: "none",
              fontFamily: "inherit",
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxShadow: inputFocused ? "0 0 0 3px rgba(37,99,235,0.12)" : "none",
            }}
            type="text"
            placeholder="Ask about shipping, returns, support hours…"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            disabled={isLoading}
            maxLength={2000}
            autoComplete="off"
            spellCheck={false}
          />
          <div
            style={{
              fontSize: "11px",
              color: inputValue.length > 1900 ? "var(--error-text)" : "var(--text-muted)",
              textAlign: "right",
              paddingRight: "8px",
            }}
          >
            {inputValue.length} / 2000
          </div>
          </div>
          <button
            id="send-btn"
            style={{
              flexShrink: 0,
              width: "46px",
              height: "46px",
              borderRadius: "14px",
              border: "none",
              color: "#fff",
              fontSize: "18px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: canSend ? "pointer" : "not-allowed",
              fontFamily: "inherit",
              background: canSend
                ? "var(--bubble-user-bg)"
                : "var(--bg-new-btn)",
              boxShadow: canSend ? "var(--shadow-glow-indigo)" : "none",
              opacity: canSend ? 1 : 0.45,
              transition: "all 0.2s",
              transform: "scale(1)",
            }}
            onMouseOver={(e) => {
              if (canSend)
                (e.currentTarget as HTMLElement).style.transform = "scale(1.08)";
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.transform = "scale(1)";
            }}
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
          >
            ➔
          </button>
        </form>
        )}
      </div>
    </div>
  );
}
