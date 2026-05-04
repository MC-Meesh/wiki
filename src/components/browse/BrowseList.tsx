"use client";

import Link from "next/link";
import { useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";

interface Entry {
  name: string;
  path: string;
  isDir: boolean;
}

function assignHotkeys(entries: Entry[]): Map<string, string> {
  const used = new Set<string>();
  const hotkeys = new Map<string, string>();

  for (const entry of entries) {
    const name = entry.name.toLowerCase();
    let key: string | null = null;

    // Try each character in the name, in order
    for (const ch of name) {
      if (/[a-z0-9]/.test(ch) && !used.has(ch)) {
        key = ch;
        break;
      }
    }

    if (key) {
      used.add(key);
      hotkeys.set(entry.path, key);
    }
  }

  return hotkeys;
}

export function BrowseList({ entries }: { entries: Entry[] }) {
  const router = useRouter();
  const hotkeys = useMemo(() => assignHotkeys(entries), [entries]);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;

      const key = e.key.toLowerCase();
      for (const entry of entries) {
        if (hotkeys.get(entry.path) === key) {
          e.preventDefault();
          const href = entry.isDir
            ? `/browse/${entry.path}`
            : `/browse/${entry.path.replace(/\.md$/, "")}`;
          router.push(href);
          return;
        }
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [entries, hotkeys, router]);

  function renderName(entry: Entry) {
    const key = hotkeys.get(entry.path);
    if (!key) return <>{entry.name}</>;
    const lower = entry.name.toLowerCase();
    const idx = lower.indexOf(key);
    if (idx < 0) return <>{entry.name}</>;
    return (
      <>
        {entry.name.slice(0, idx)}
        <span className="text-foreground underline underline-offset-2">
          {entry.name[idx]}
        </span>
        {entry.name.slice(idx + 1)}
      </>
    );
  }

  return (
    <ul className="space-y-0">
      {entries.map((entry) => {
        const key = hotkeys.get(entry.path);
        return (
          <li key={entry.path} className="border-b border-accent/10">
            <Link
              href={
                entry.isDir
                  ? `/browse/${entry.path}`
                  : `/browse/${entry.path.replace(/\.md$/, "")}`
              }
              className="flex items-center justify-between gap-3 px-2 py-3 text-muted hover:text-foreground transition-colors group"
            >
              <span className="text-sm flex-1 truncate">
                {renderName(entry)}
                {entry.isDir && <span className="text-accent">/</span>}
              </span>
              {key && (
                <kbd className="text-[10px] text-accent/60 group-hover:text-accent border border-accent/30 rounded px-1.5 py-0.5 font-mono shrink-0 hidden sm:inline">
                  {key}
                </kbd>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
