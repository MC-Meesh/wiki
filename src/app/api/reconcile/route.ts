import { NextRequest, NextResponse } from "next/server";
import { reconcileDaily } from "@/lib/reconciler";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  // Auth: check for internal cron secret or valid session
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const log = await reconcileDaily();
    return NextResponse.json({ ok: true, log });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
