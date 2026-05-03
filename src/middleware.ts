import { withAuth } from "next-auth/middleware";

export default withAuth({ pages: { signIn: "/login" } });

export const config = {
  matcher: [
    "/((?!api/auth|api/reconcile|api/webhook|login|_next/static|_next/image|favicon.ico|manifest.json|icon-.*).*)",
  ],
};
