import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const run = promisify(exec);

export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || "wiki-sync-secret";

export async function POST(request: NextRequest) {
  // Verify webhook secret (passed as query param or header)
  const secret =
    request.headers.get("x-webhook-secret") ||
    request.nextUrl.searchParams.get("secret");
  if (secret !== WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const wikiPath = process.env.WIKI_PATH || "/tmp/wiki";

  try {
    const { stdout, stderr } = await run(
      `cd ${wikiPath} && git fetch origin main && git rebase origin/main`,
      { timeout: 15000 }
    );
    return NextResponse.json({
      ok: true,
      message: "Pulled latest",
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    // Try abort rebase if it failed
    await run(`cd ${wikiPath} && git rebase --abort`).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
