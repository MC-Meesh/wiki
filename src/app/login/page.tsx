"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "login", pin }),
    });
    if (res.ok) {
      router.push("/");
    } else {
      setError("Invalid PIN");
      setPin("");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-950">
      <form
        onSubmit={submit}
        className="flex flex-col gap-4 w-full max-w-xs px-6"
      >
        <h1 className="text-white text-xl font-semibold text-center">
          llm-wiki
        </h1>
        <input
          type="password"
          inputMode="numeric"
          placeholder="PIN"
          value={pin}
          onChange={(e) => setPin(e.target.value)}
          autoFocus
          className="bg-neutral-900 text-white rounded-lg px-4 py-3 text-center text-2xl tracking-widest outline-none border border-neutral-800 focus:border-neutral-500"
        />
        {error && (
          <p className="text-red-400 text-sm text-center">{error}</p>
        )}
        <button
          type="submit"
          className="bg-white text-black rounded-lg py-3 font-medium"
        >
          Unlock
        </button>
      </form>
    </div>
  );
}
