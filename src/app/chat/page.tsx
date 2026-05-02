"use client";

import { Suspense, useState, useRef, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function ChatPageWrapper() {
  return (
    <Suspense
      fallback={<div className="p-5 text-muted text-xs">loading...</div>}
    >
      <ChatPage />
    </Suspense>
  );
}

function ChatPage() {
  const searchParams = useSearchParams();
  const context = searchParams.get("context");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function handleSend() {
    if (!input.trim() || isLoading) return;
    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          context: context || undefined,
        }),
      });

      if (!res.ok) throw new Error("Chat failed");

      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      setMessages([...newMessages, { role: "assistant", content: "" }]);

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantContent += decoder.decode(value);
        setMessages([
          ...newMessages,
          { role: "assistant", content: assistantContent },
        ]);
      }
    } catch {
      setMessages([
        ...newMessages,
        { role: "assistant", content: "error: could not get response." },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-96px-var(--sab))]">
      {context && (
        <div className="px-5 py-2 text-xs text-accent border-b border-accent/20 font-mono">
          ctx: {context}
        </div>
      )}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
        {messages.length === 0 && (
          <p className="text-accent text-xs text-center mt-12 font-mono">
            &gt; ask me anything about your wiki
          </p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`text-sm font-mono ${
              msg.role === "user"
                ? "text-foreground ml-8"
                : "text-muted mr-8 border-l border-accent/30 pl-3"
            }`}
          >
            <span className="text-accent text-xs">
              {msg.role === "user" ? "> " : ""}
            </span>
            {msg.content ||
              (isLoading && i === messages.length - 1 ? "..." : "")}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      <div className="px-4 py-3 border-t border-accent/20">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && !e.shiftKey && handleSend()
            }
            placeholder="> message"
            className="flex-1 bg-transparent text-foreground border border-accent/30 rounded px-3 py-2 text-xs font-mono outline-none focus:border-foreground/50 transition-colors placeholder:text-accent"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="px-4 py-2 border border-accent/30 text-muted hover:text-foreground hover:border-foreground/50 rounded text-xs font-mono transition-all disabled:opacity-30"
          >
            send
          </button>
        </div>
      </div>
    </div>
  );
}
