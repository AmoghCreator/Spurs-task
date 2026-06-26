import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3002";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const res = await fetch(`${API_URL}/chat/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      return NextResponse.json(errorData, { status: res.status });
    }

    return new NextResponse(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        "Connection": "keep-alive",
      },
    });
  } catch (err) {
    console.error("[proxy/chat/message] Error:", err);
    return NextResponse.json(
      { error: "Failed to reach the backend. Please try again." },
      { status: 502 }
    );
  }
}
