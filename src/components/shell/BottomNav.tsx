"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "daily" },
  { href: "/browse", label: "browse" },
  { href: "/chat", label: "chat" },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-t border-accent/20">
      <div className="flex items-center justify-around h-12 pb-[var(--sab)]">
        {NAV_ITEMS.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/" || pathname.startsWith("/daily")
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`text-xs uppercase tracking-wider transition-colors duration-300 px-4 py-2 ${
                active ? "text-foreground" : "text-muted hover:text-foreground"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
