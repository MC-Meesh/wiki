"use client";

import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { ChatFAB } from "./ChatFAB";
import { StatusBar } from "./StatusBar";
import { usePathname } from "next/navigation";

export function MobileShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isChat = pathname === "/chat";

  return (
    <div className="min-h-screen flex flex-col">
      <StatusBar />
      <main className="flex-1 pt-12 pb-[calc(48px+var(--sab))]">
        {children}
      </main>
      {!isChat && <ChatFAB />}
      <BottomNav />
    </div>
  );
}
