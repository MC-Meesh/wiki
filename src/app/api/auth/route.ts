import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "llm-wiki-session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "llm-wiki-dev-secret";
const ACCESS_PIN = process.env.ACCESS_PIN;

export async function POST(request: NextRequest) {
  const { action, pin } = await request.json();

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (action === "login") {
    if (!ACCESS_PIN || pin !== ACCESS_PIN) {
      return NextResponse.json({ error: "Invalid PIN" }, { status: 401 });
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, SESSION_SECRET, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
