"use client";

import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-page)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-outfit)",
        textAlign: "center",
        padding: "24px",
        overflow: "hidden",
      }}
    >
      {/* ── Ambient blobs ── */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "-18%",
          left: "-12%",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background: "var(--bg-blob-1)",
          pointerEvents: "none",
          animation: "blobPulse 8s ease-in-out infinite",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          bottom: "-18%",
          right: "-12%",
          width: "50vw",
          height: "50vw",
          borderRadius: "50%",
          background: "var(--bg-blob-2)",
          pointerEvents: "none",
          animation: "blobPulse 10s ease-in-out infinite 2s",
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          top: "40%",
          right: "15%",
          width: "28vw",
          height: "28vw",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(124,58,237,0.06) 0%, transparent 70%)",
          pointerEvents: "none",
          animation: "blobPulse 12s ease-in-out infinite 4s",
        }}
      />

      {/* ── Content card ── */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "20px",
          maxWidth: "520px",
          width: "100%",
          background: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          borderRadius: "28px",
          padding: "clamp(32px, 5vw, 56px) clamp(24px, 5vw, 48px)",
          boxShadow: "var(--shadow-card)",
          backdropFilter: "blur(24px)",
          WebkitBackdropFilter: "blur(24px)",
        }}
      >
        {/* Brand badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            background: "var(--bg-chip)",
            border: "1px solid var(--border-chip)",
            borderRadius: "100px",
            padding: "5px 14px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--text-chip)",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
          }}
        >
          <span style={{ fontSize: "10px" }}>●</span>
          AI Support Agent
        </div>

        {/* Robot icon with float animation */}
        <div
          aria-hidden="true"
          style={{
            fontSize: "clamp(48px, 8vw, 64px)",
            lineHeight: 1,
            animation: "floatY 4s ease-in-out infinite",
            filter: "drop-shadow(0 0 28px rgba(37,99,235,0.40))",
          }}
        >
          🤖
        </div>

        {/* Headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <h1
            style={{
              fontSize: "clamp(26px, 5vw, 38px)",
              fontWeight: 800,
              letterSpacing: "-0.03em",
              lineHeight: 1.15,
              color: "var(--text-primary)",
            }}
          >
            Mr.Spurs
          </h1>
          <p
            style={{
              color: "var(--text-secondary)",
              fontSize: "clamp(14px, 2vw, 16px)",
              lineHeight: 1.65,
              maxWidth: "380px",
              margin: "0 auto",
            }}
          >
            AI-powered customer support for Mr.Spurs Store. Instant answers on
            shipping, returns, and more — 24/7.
          </p>
        </div>

        {/* CTA button */}
        <Link
          href="/chat"
          id="open-chat-btn"
          style={{
            background: "var(--bubble-user-bg)",
            color: "#fff",
            padding: "14px 36px",
            borderRadius: "14px",
            fontWeight: 700,
            fontSize: "clamp(14px, 2vw, 16px)",
            textDecoration: "none",
            boxShadow: "var(--shadow-glow-blue)",
            animation: "glowPulse 3s ease-in-out infinite",
            transition: "opacity 0.2s, transform 0.2s",
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            letterSpacing: "-0.01em",
          }}
          onMouseOver={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "0.90";
            (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)";
          }}
          onMouseOut={(e) => {
            (e.currentTarget as HTMLElement).style.opacity = "1";
            (e.currentTarget as HTMLElement).style.transform = "translateY(0)";
          }}
        >
          Open Chat
          <span aria-hidden="true" style={{ fontSize: "16px" }}>→</span>
        </Link>

        {/* Feature pills */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            flexWrap: "wrap",
            justifyContent: "center",
          }}
        >
          {["Shipping", "Returns", "Support Hours"].map((label) => (
            <span
              key={label}
              style={{
                background: "var(--bg-chip)",
                border: "1px solid var(--border-chip)",
                borderRadius: "100px",
                color: "var(--text-chip)",
                fontSize: "12px",
                fontWeight: 500,
                padding: "5px 12px",
              }}
            >
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <p
        style={{
          position: "relative",
          zIndex: 1,
          marginTop: "20px",
          fontSize: "12px",
          color: "var(--text-muted)",
        }}
      >
        Powered by AI · Available 24/7
      </p>
    </main>
  );
}
