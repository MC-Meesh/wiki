"use client";

import { signIn } from "next-auth/react";

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col gap-6 items-center">
        <h1 className="text-foreground text-lg font-mono">wiki</h1>
        <button
          onClick={() => signIn("github", { callbackUrl: "/" })}
          className="px-6 py-3 border border-accent/30 text-muted hover:text-foreground hover:border-foreground/50 rounded text-sm font-mono transition-all"
        >
          sign in with github
        </button>
      </div>
    </div>
  );
}
