/**
 * LLM provider abstraction. Swap providers via the LLM_PROVIDER env var.
 * Supported: claude-cli | anthropic | openai | ollama
 */

import { spawn } from "child_process";

export type LLMProvider = "claude-cli" | "anthropic" | "openai" | "ollama";

export interface LLMConfig {
  provider: LLMProvider;
  model?: string;
  apiKey?: string;
  baseUrl?: string;
}

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

export function getLLMConfig(): LLMConfig {
  const provider = (process.env.LLM_PROVIDER as LLMProvider) ?? "claude-cli";
  return {
    provider,
    model: process.env.LLM_MODEL,
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL,
  };
}

export async function* streamChat(
  messages: Message[],
  config: LLMConfig
): AsyncGenerator<string> {
  switch (config.provider) {
    case "claude-cli":
      yield* streamClaude(messages);
      break;
    case "anthropic":
      yield* streamAnthropic(messages, config);
      break;
    case "openai":
      yield* streamOpenAI(messages, config);
      break;
    case "ollama":
      yield* streamOllama(messages, config);
      break;
    default:
      throw new Error(`Unknown LLM provider: ${config.provider}`);
  }
}

async function* streamClaude(messages: Message[]): AsyncGenerator<string> {
  const systemMsg = messages.find((m) => m.role === "system");
  const userMessages = messages.filter((m) => m.role !== "system");
  const lastUser = userMessages.at(-1);
  if (!lastUser) return;

  const args = ["--output-format", "stream-json", "--print"];
  if (systemMsg) args.push("--system", systemMsg.content);
  args.push(lastUser.content);

  const proc = spawn("claude", args, { env: process.env });
  for await (const chunk of proc.stdout) {
    const text = chunk.toString();
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        if (event.type === "text" && event.text) yield event.text;
        else if (event.type === "content_block_delta")
          yield event.delta?.text ?? "";
      } catch {
        // non-JSON line — skip
      }
    }
  }
}

async function* streamAnthropic(
  messages: Message[],
  config: LLMConfig
): AsyncGenerator<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({ apiKey: config.apiKey });
  const systemMsg = messages.find((m) => m.role === "system")?.content;
  const chatMessages = messages
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }));

  const stream = await client.messages.stream({
    model: config.model ?? "claude-sonnet-4-5",
    max_tokens: 8096,
    system: systemMsg,
    messages: chatMessages,
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

async function* streamOpenAI(
  messages: Message[],
  config: LLMConfig
): AsyncGenerator<string> {
  const { default: OpenAI } = await import("openai");
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseUrl,
  });

  const stream = await client.chat.completions.create({
    model: config.model ?? "gpt-4o",
    messages,
    stream: true,
  });

  for await (const chunk of stream) {
    yield chunk.choices[0]?.delta?.content ?? "";
  }
}

async function* streamOllama(
  messages: Message[],
  config: LLMConfig
): AsyncGenerator<string> {
  const baseUrl = config.baseUrl ?? "http://localhost:11434";
  const res = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: config.model ?? "llama3",
      messages,
      stream: true,
    }),
  });

  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    for (const line of text.split("\n")) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        yield event.message?.content ?? "";
      } catch {
        // skip
      }
    }
  }
}
