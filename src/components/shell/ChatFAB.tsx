"use client";

import { usePathname, useRouter } from "next/navigation";

export function ChatFAB() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/chat") return null;

  const context = pathname.startsWith("/daily/")
    ? `daily/${pathname.split("/")[2]}.md`
    : pathname.startsWith("/browse/")
      ? pathname.replace("/browse/", "")
      : undefined;

  return (
    <button
      onClick={() =>
        router.push(
          context ? `/chat?context=${encodeURIComponent(context)}` : "/chat"
        )
      }
      className="fixed bottom-[calc(56px+var(--sab))] right-4 z-40 w-10 h-10 border border-accent/30 bg-background/80 backdrop-blur-md text-muted hover:text-foreground hover:border-foreground/50 rounded-full flex items-center justify-center text-sm transition-all duration-300 active:scale-95"
      aria-label="Chat"
    >
      &gt;_
    </button>
  );
}
