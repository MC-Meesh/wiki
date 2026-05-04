import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readWikiFile, writeWikiFile } from "@/lib/wiki";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ date: string }> }
) {
  const session = await getSession();
  if (!session.authenticated)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { date } = await params;
  const { line, checked } = await request.json();

  const path = `daily/${date}.md`;
  const content = await readWikiFile(path);
  if (content === null)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const lines = content.split("\n");
  if (line < 0 || line >= lines.length)
    return NextResponse.json({ error: "Invalid line" }, { status: 400 });

  const match = lines[line].match(/^(\s*-\s+\[)([ xX])(\]\s+.*)$/);
  if (!match)
    return NextResponse.json({ error: "Not a todo" }, { status: 400 });

  lines[line] = `${match[1]}${checked ? "x" : " "}${match[3]}`;
  await writeWikiFile(path, lines.join("\n"), `wiki-app: toggle todo ${date}:${line}`);
  return NextResponse.json({ ok: true });
}
