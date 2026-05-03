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
    <div className="h-dvh flex flex-col overflow-hidden">
      <StatusBar />
      <main className={`flex-1 pt-12 pb-[calc(48px+var(--sab))] ${isChat ? "overflow-hidden flex flex-col" : "overflow-y-auto"}`}>
        {children}
      </main>
      {!isChat && <ChatFAB />}
      <BottomNav />
    </div>
  );
}
