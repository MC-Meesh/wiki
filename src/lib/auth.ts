import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";

export async function getSession(): Promise<{ authenticated: boolean }> {
  if (process.env.SKIP_AUTH === "true") return { authenticated: true };
  const session = await getServerSession(authOptions);
  return { authenticated: !!session };
}
