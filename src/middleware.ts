import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

const SKIP_AUTH = process.env.SKIP_AUTH === "true";

export default auth((req) => {
  if (SKIP_AUTH) return NextResponse.next();
  if (!req.auth) {
    const signInUrl = new URL("/api/auth/signin", req.url);
    signInUrl.searchParams.set("callbackUrl", req.url);
    return NextResponse.redirect(signInUrl);
  }
  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!api/auth|api/reconcile|api/webhook|_next/static|_next/image|favicon.ico|manifest.json|icon-.*).*)",
  ],
};
