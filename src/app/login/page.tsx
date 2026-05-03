"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type Phase = "idle" | "pending" | "authorized" | "error";

export default function LoginPage() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [userCode, setUserCode] = useState("");
  const [verifyUrl, setVerifyUrl] = useState("https://github.com/login/device");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const deviceCodeRef = useRef("");
  const [copied, setCopied] = useState(false);

  const copyCode = useCallback(() => {
    navigator.clipboard.writeText(userCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [userCode]);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  async function start() {
    setPhase("pending");
    setErrorMsg("");
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "device-start" }),
      });
      const data = await res.json();
      if (data.error) {
        setErrorMsg(data.error);
        setPhase("error");
        return;
      }
      setUserCode(data.user_code);
      setVerifyUrl(data.verification_uri ?? "https://github.com/login/device");
      deviceCodeRef.current = data.device_code;
      const interval = Math.max((data.interval ?? 5) * 1000, 5000);
      pollRef.current = setInterval(() => poll(interval), interval);
    } catch {
      setErrorMsg("Failed to reach GitHub");
      setPhase("error");
    }
  }

  async function poll(_interval: number) {
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "device-poll", device_code: deviceCodeRef.current }),
      });
      const data = await res.json();
      if (data.ok) {
        stopPolling();
        setPhase("authorized");
        window.location.href = "/";
        return;
      }
      if (data.error === "access_denied" || data.error === "expired_token") {
        stopPolling();
        setErrorMsg(data.error === "access_denied" ? "Access denied" : "Code expired — try again");
        setPhase("error");
      } else if (data.error && data.error !== "authorization_pending" && data.error !== "slow_down") {
        stopPolling();
        setErrorMsg(`Auth error: ${data.error}`);
        setPhase("error");
      }
      // authorization_pending or slow_down: keep polling
    } catch {
      // network hiccup — keep polling
    }
  }

  useEffect(() => () => stopPolling(), []);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="flex flex-col gap-6 items-center max-w-sm w-full px-6">
        <h1 className="text-foreground text-lg font-mono">wiki</h1>

        {phase === "idle" && (
          <button
            onClick={start}
            className="px-6 py-3 border border-accent/30 text-muted hover:text-foreground hover:border-foreground/50 rounded text-sm font-mono transition-all"
          >
            sign in with github
          </button>
        )}

        {phase === "pending" && userCode && (
          <div className="flex flex-col gap-4 items-center text-center">
            <a
              href={verifyUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted text-sm font-mono hover:text-foreground transition-colors"
            >
              github.com/login/device ↗
            </a>
            <div className="flex items-center gap-2">
              <div className="px-6 py-3 border border-accent/30 rounded font-mono text-foreground text-2xl tracking-widest select-all">
                {userCode}
              </div>
              <button
                onClick={copyCode}
                className="px-3 py-3 border border-accent/30 text-muted hover:text-foreground hover:border-foreground/50 rounded text-xs font-mono transition-all"
                title="Copy code"
              >
                {copied ? "✓" : "copy"}
              </button>
            </div>
            <p className="text-muted text-xs font-mono">enter this code then wait — this page will update automatically</p>
          </div>
        )}

        {phase === "pending" && !userCode && (
          <p className="text-muted text-sm font-mono">contacting github...</p>
        )}

        {phase === "error" && (
          <div className="flex flex-col gap-4 items-center">
            <p className="text-muted text-sm font-mono">{errorMsg}</p>
            <button
              onClick={start}
              className="px-6 py-3 border border-accent/30 text-muted hover:text-foreground hover:border-foreground/50 rounded text-sm font-mono transition-all"
            >
              try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
