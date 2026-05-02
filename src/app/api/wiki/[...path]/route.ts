import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWikiFile, writeWikiFile, listWikiDir } from "@/lib/wiki";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await params;
  const filePath = path.join("/");

  if (filePath.endsWith("/") || !filePath.includes(".")) {
    const dir = filePath.replace(/\/$/, "");
    const entries = await listWikiDir(dir);
    return NextResponse.json(entries);
  }

  const content = await readWikiFile(filePath);
  if (content === null) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ content, path: filePath });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { path } = await params;
  const filePath = path.join("/");
  const { content, message } = await request.json();

  await writeWikiFile(filePath, content, message);
  return NextResponse.json({ ok: true });
}
