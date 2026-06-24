import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        gap: "24px",
        background: "#080c14",
        color: "#f8fafc",
        fontFamily: "var(--font-outfit, system-ui, sans-serif)",
        textAlign: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          fontSize: "56px",
          lineHeight: 1,
          filter: "drop-shadow(0 0 24px rgba(59,130,246,0.5))",
        }}
      >
        🤖
      </div>
      <h1 style={{ fontSize: "32px", fontWeight: 700, letterSpacing: "-0.02em" }}>
        Lobstral Support
      </h1>
      <p style={{ color: "#94a3b8", maxWidth: "400px", lineHeight: 1.6 }}>
        AI-powered customer support for Lobstral Store. Ask about shipping,
        returns, and support hours — instantly.
      </p>
      <Link
        href="/chat"
        style={{
          background: "linear-gradient(135deg, #3b82f6, #6366f1)",
          color: "#fff",
          padding: "14px 32px",
          borderRadius: "12px",
          fontWeight: 600,
          fontSize: "16px",
          textDecoration: "none",
          boxShadow: "0 8px 24px rgba(59,130,246,0.35)",
          transition: "opacity 0.2s",
        }}
      >
        Open Chat →
      </Link>
    </main>
  );
}
