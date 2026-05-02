import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { getLLMConfig, streamChat } from "@/lib/llm";
import { readFile } from "fs/promises";
import { join } from "path";

export const dynamic = "force-dynamic";

const WIKI_PATH = process.env.WIKI_PATH ?? "/tmp/wiki";
const TZ = process.env.TZ ?? "America/Denver";
const AGENT_FILE = process.env.AGENT_FILE ?? "AGENT.md";

function today(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

async function readOrNull(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf-8");
  } catch {
    return null;
  }
}

async function buildSystemPrompt(context?: string): Promise<string> {
  const date = today();
  const parts: string[] = [`Today's date: ${date}`];

  // Load AGENT.md (falls back to CLAUDE.md for backwards compatibility)
  const agentMd =
    (await readOrNull(join(WIKI_PATH, AGENT_FILE))) ??
    (await readOrNull(join(WIKI_PATH, "CLAUDE.md")));
  if (agentMd) parts.push(`\n--- Wiki instructions ---\n${agentMd}\n---`);

  // Pre-load today's daily note
  const todayFile = await readOrNull(join(WIKI_PATH, "daily", `${date}.md`));
  if (todayFile) {
    parts.push(`\n--- Today's daily note ---\n${todayFile}\n---`);
  }

  // Include the file the user is currently viewing, if any
  if (context) {
    const contextFile = await readOrNull(join(WIKI_PATH, context));
    if (contextFile) {
      parts.push(`\n--- Currently viewing: ${context} ---\n${contextFile}\n---`);
    }
  }

  parts.push(
    `\nYou have full read/write access to the wiki at ${WIKI_PATH}. ` +
      `Changes you make are committed and synced to GitHub automatically. Be concise.`
  );

  return parts.join("\n");
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.authenticated) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, context } = await request.json();
  const systemPrompt = await buildSystemPrompt(context);
  const llmConfig = getLLMConfig();

  const allMessages = [
    { role: "system" as const, content: systemPrompt },
    ...messages,
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamChat(allMessages, llmConfig)) {
          if (chunk) controller.enqueue(encoder.encode(chunk));
        }
      } catch (err) {
        controller.enqueue(
          encoder.encode(`\nError: ${err instanceof Error ? err.message : String(err)}`)
        );
      } finally {
        controller.close();
      }
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
