import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "llm-wiki-session";
const CLIENT_ID = process.env.AUTH_GITHUB_ID!;
const ALLOWED_USERNAME = process.env.ALLOWED_GITHUB_USERNAME;

function makeSessionToken() {
  const secret = process.env.AUTH_SECRET ?? "llm-wiki-dev-secret";
  const ts = Date.now().toString(36);
  return `${secret}.${ts}`;
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { action } = body;

  if (action === "logout") {
    const res = NextResponse.json({ ok: true });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  }

  if (action === "device-start") {
    const params = new URLSearchParams({ client_id: CLIENT_ID, scope: "read:user" });
    const ghRes = await fetch("https://github.com/login/device/code", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: params,
    });
    const data = await ghRes.json();
    return NextResponse.json(data);
  }

  if (action === "device-poll") {
    const { device_code } = body;
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      device_code,
      grant_type: "urn:ietf:params:oauth:grant-type:device_code",
    });
    const ghRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: params,
    });
    const data = await ghRes.json();

    if (data.error) {
      return NextResponse.json({ error: data.error });
    }

    const { access_token } = data;

    if (ALLOWED_USERNAME) {
      const userRes = await fetch("https://api.github.com/user", {
        headers: { Authorization: `Bearer ${access_token}`, "User-Agent": "llm-wiki" },
      });
      const user = await userRes.json();
      if (user.login !== ALLOWED_USERNAME) {
        return NextResponse.json({ error: "access_denied" }, { status: 403 });
      }
    }

    const token = makeSessionToken();
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30,
    });
    return res;
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
