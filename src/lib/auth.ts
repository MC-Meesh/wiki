import { cookies } from "next/headers";

const SESSION_COOKIE = "llm-wiki-session";

export async function getSession(): Promise<{ authenticated: boolean }> {
  if (process.env.SKIP_AUTH === "true") return { authenticated: true };
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  const secret = process.env.AUTH_SECRET ?? "llm-wiki-dev-secret";
  return { authenticated: !!token && token.startsWith(secret) };
}
