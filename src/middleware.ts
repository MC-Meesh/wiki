import { NextRequest, NextResponse } from "next/server";

const SKIP_AUTH = process.env.SKIP_AUTH === "true";
const SESSION_COOKIE = "llm-wiki-session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "llm-wiki-dev-secret";

export function middleware(req: NextRequest) {
  if (SKIP_AUTH) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token === SESSION_SECRET) return NextResponse.next();

  return NextResponse.redirect(new URL("/login", req.url));
}

export const config = {
  matcher: [
    "/((?!api/auth|api/reconcile|api/webhook|login|_next/static|_next/image|favicon.ico|manifest.json|icon-.*).*)",
  ],
};
