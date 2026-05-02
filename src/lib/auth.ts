/**
 * Auth — minimal single-user auth for self-hosted deployments.
 *
 * SKIP_AUTH=true  → no login required (default, recommended for local/private)
 * SKIP_AUTH=false → session cookie set via POST /api/auth/login with ACCESS_PIN
 */

import { cookies } from "next/headers";

const SESSION_COOKIE = "llm-wiki-session";
const SESSION_SECRET = process.env.SESSION_SECRET ?? "llm-wiki-dev-secret";

export function isAuthDisabled() {
  return process.env.SKIP_AUTH === "true";
}

export async function getSession(): Promise<{ authenticated: boolean }> {
  if (isAuthDisabled()) return { authenticated: true };
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  return { authenticated: token === SESSION_SECRET };
}

export async function requireAuth(): Promise<void | never> {
  const session = await getSession();
  if (!session.authenticated) {
    throw new Error("Unauthorized");
  }
}
