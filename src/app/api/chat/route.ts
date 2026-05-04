import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { readFile } from "fs/promises";
import { join } from "path";
import { spawn, ChildProcess } from "child_process";

export const dynamic = "force-dynamic";

const WIKI_PATH = process.env.WIKI_PATH ?? "/tmp/wiki";
const TZ = process.env.TZ ?? "America/Denver";

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

async function readOrNull(path: string): Promise<string | null> {
  try { return await readFile(path, "utf-8"); } catch { return null; }
}

async function buildSystemPrompt(context?: string): Promise<string> {
  const date = today();
  const parts: string[] = [`Today's date: ${date}`];
  const claudeMd =
    (await readOrNull(join(WIKI_PATH, "CLAUDE.md"))) ??
    (await readOrNull(join(WIKI_PATH, "AGENT.md")));
  if (claudeMd) parts.push(`\n--- Wiki instructions ---\n${claudeMd}\n---`);
  const todayFile = await readOrNull(join(WIKI_PATH, "daily", `${date}.md`));
  if (todayFile) parts.push(`\n--- Today's daily note ---\n${todayFile}\n---`);
  if (context) {
    const contextFile = await readOrNull(join(WIKI_PATH, context));
    if (contextFile) parts.push(`\n--- Currently viewing: ${context} ---\n${contextFile}\n---`);
  }
  parts.push(`\nYou have full read/write access to the wiki at ${WIKI_PATH}. Changes you make are committed and synced automatically. Be concise.`);
  return parts.join("\n");
}

// Pre-warmed process: spawned immediately after each response so the next
// request skips Node.js startup / module loading (~1-1.5s saved).
let warm: ChildProcess | null = null;

function spawnClaude(prompt: string, systemPrompt: string): ChildProcess {
  return spawn("claude", [
    "-p", prompt,
    "--add-dir", WIKI_PATH,
    "--append-system-prompt", systemPrompt,
    "--permission-mode", "bypassPermissions",
    "--output-format", "stream-json",
    "--include-partial-messages",
    "--verbose",
  ], { env: { ...process.env, HOME: process.env.HOME ?? "/tmp" } });
}

function warmNext() {
  // Spawn with a trivial prompt so Node/modules/creds are loaded and ready
  warm = spawn("claude", [
    "-p", " ",
    "--output-format", "stream-json",
    "--verbose",
    "--permission-mode", "bypassPermissions",
  ], { env: { ...process.env, HOME: process.env.HOME ?? "/tmp" } });
  warm.on("close", () => { warm = null; });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.authenticated) return new Response("Unauthorized", { status: 401 });

  const { messages, context } = await request.json();
  const systemPrompt = await buildSystemPrompt(context);
  const lastUserMessage = messages.at(-1)?.content ?? "";
  const prompt = context ? `(viewing ${context})\n\n${lastUserMessage}` : lastUserMessage;

  // Kill the warm process (already past startup) and spawn real one
  if (warm) { warm.kill(); warm = null; }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const claude = spawnClaude(prompt, systemPrompt);
      let buf = "";

      claude.stdout!.on("data", (chunk: Buffer) => {
        buf += chunk.toString();
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          const text = extractText(line);
          if (text) controller.enqueue(encoder.encode(text));
        }
      });

      claude.on("close", () => {
        const text = extractText(buf);
        if (text) controller.enqueue(encoder.encode(text));
        controller.close();
        warmNext(); // pre-warm for next request
      });

      claude.on("error", (err) => {
        controller.enqueue(encoder.encode(`\nError: ${err.message}`));
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function extractText(line: string): string {
  if (!line.trim()) return "";
  try {
    const event = JSON.parse(line);
    if (event.type === "stream_event") {
      const inner = event.event;
      if (inner?.type === "content_block_delta" && inner.delta?.type === "text_delta") {
        return inner.delta.text ?? "";
      }
    }
    if (event.type === "assistant") {
      return event.message?.content
        ?.filter((b: { type: string }) => b.type === "tool_use")
        ?.map((b: { name: string }) => `\n\n_${b.name}..._\n\n`)
        ?.join("") ?? "";
    }
  } catch {}
  return "";
}
