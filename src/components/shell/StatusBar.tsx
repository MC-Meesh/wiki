"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

export function StatusBar() {
  const pathname = usePathname();

  let title = "wiki";
  if (pathname.startsWith("/daily/")) {
    const date = pathname.split("/")[2];
    const d = new Date(date + "T12:00:00");
    title = d.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
  } else if (pathname.startsWith("/browse")) {
    const parts = pathname.split("/").filter(Boolean);
    title = parts.length > 1 ? `/${parts.slice(1).join("/")}` : "/browse";
  } else if (pathname.startsWith("/edit")) {
    title = "edit";
  } else if (pathname === "/chat") {
    title = "chat";
  }

  const showBack =
    pathname !== "/" && !pathname.match(/^\/daily\/\d{4}-\d{2}-\d{2}$/);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-background/80 backdrop-blur-md border-b border-accent/20 flex items-center px-4 pt-[var(--sat)]">
      {showBack && (
        <Link
          href="/"
          className="mr-3 text-muted hover:text-foreground transition-colors text-sm"
        >
          &larr;
        </Link>
      )}
      <h1 className="text-xs font-medium tracking-wider uppercase text-muted truncate">
        {title}
      </h1>
    </header>
  );
}
