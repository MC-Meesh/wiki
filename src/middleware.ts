import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "llm-wiki-session";

export function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET ?? "llm-wiki-dev-secret";
  if (!token || !token.startsWith(secret)) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }
  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api/auth|login|_next/static|_next/image|favicon.ico|manifest.json|icon-.*).*)",
  ],
};
