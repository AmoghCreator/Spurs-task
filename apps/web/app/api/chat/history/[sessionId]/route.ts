import { NextRequest, NextResponse } from "next/server";

const API_URL = process.env.API_URL ?? "http://localhost:3002";

export async function GET(
  _req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  try {
    const res = await fetch(`${API_URL}/chat/history/${params.sessionId}`);
    const data = await res.json();
    return NextResponse.json(data, { status: res.status });
  } catch (err) {
    console.error("[proxy/chat/history] Error:", err);
    return NextResponse.json(
      { error: "Failed to reach the backend. Please try again." },
      { status: 502 }
    );
  }
}
