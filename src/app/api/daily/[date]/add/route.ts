import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWikiFile, writeWikiFile } from "@/lib/wiki";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  if (process.env.SKIP_AUTH !== "true") {
    const session = await auth();
    if (!session)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { date } = await params;
  const { text } = await request.json();
  if (!text || typeof text !== "string")
    return NextResponse.json({ error: "Missing text" }, { status: 400 });

  const path = `daily/${date}.md`;
  let content = await readWikiFile(path);

  if (content === null) {
    const dayName = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
      weekday: "long",
    });
    content = `---\ndate: ${date}\nstatus: active\n---\n# ${date} (${dayName})\n\n## Focus\n\n`;
  }

  const lines = content.split("\n");
  const focusIdx = lines.findIndex((l) => /^##\s+Focus/i.test(l));

  if (focusIdx >= 0) {
    // Find the end of the Focus section (next ## or end of file)
    let insertIdx = focusIdx + 1;
    while (
      insertIdx < lines.length &&
      !/^##\s/.test(lines[insertIdx])
    ) {
      insertIdx++;
    }
    // Skip trailing blank lines
    while (insertIdx > focusIdx + 1 && lines[insertIdx - 1].trim() === "") {
      insertIdx--;
    }
    lines.splice(insertIdx, 0, `- [ ] ${text}`);
  } else {
    lines.push("", "## Focus", `- [ ] ${text}`);
  }

  await writeWikiFile(path, lines.join("\n"), `wiki-app: add todo to ${date}`);
  return NextResponse.json({ ok: true });
}
