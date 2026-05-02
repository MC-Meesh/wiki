"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function QuickAddTodo({ date }: { date: string }) {
  const [text, setText] = useState("");
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  async function handleAdd() {
    if (!text.trim() || adding) return;
    setAdding(true);
    const res = await fetch(`/api/daily/${date}/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text.trim() }),
    });
    if (res.ok) {
      setText("");
      router.refresh();
    }
    setAdding(false);
  }

  return (
    <div className="fixed bottom-[calc(48px+var(--sab))] left-0 right-0 px-4 py-2 bg-background/80 backdrop-blur-md border-t border-accent/20 z-30">
      <div className="flex gap-2 max-w-lg mx-auto">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder="+ add todo"
          className="flex-1 bg-transparent text-foreground border border-accent/30 rounded px-3 py-2 text-xs font-mono outline-none focus:border-foreground/50 transition-colors placeholder:text-accent"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !text.trim()}
          className="px-4 py-2 border border-accent/30 text-muted hover:text-foreground hover:border-foreground/50 rounded text-xs font-mono uppercase tracking-wider transition-all disabled:opacity-30"
        >
          add
        </button>
      </div>
    </div>
  );
}
