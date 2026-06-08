"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { DEMO_TERMINAL_LINES } from "./fixtures";
import { TerminalLog } from "./terminal-log";

// Standalone Act-1 terminal scene (optional cold-open at /dashboard/demo/terminal):
// animates the real `upstream run` output then offers Continue → login. Keys:
// Enter = continue (once done), R = restart. The same animation is reused inside
// the add-camera panel (the canonical Part-1 home).
export function DemoTerminal() {
  const router = useRouter();
  const [done, setDone] = useState(false);
  const [runKey, setRunKey] = useState(0);

  const restart = useCallback(() => {
    setDone(false);
    setRunKey((k) => k + 1);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && done) router.push("/dashboard/login");
      else if (e.key.toLowerCase() === "r") restart();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [done, router, restart]);

  return (
    <div
      data-demo-terminal
      style={{
        position: "fixed",
        inset: 0,
        background: "#0b0f0c",
        color: "#fff",
        display: "flex",
        flexDirection: "column",
        padding: "clamp(20px,4vw,64px)",
        font: "500 clamp(14px,1.6vw,20px)/1.6 ui-monospace, SFMono-Regular, Menlo, monospace",
        overflow: "hidden",
      }}
    >
      <TerminalLog
        key={runKey}
        lines={DEMO_TERMINAL_LINES}
        showLogo
        onDone={() => setDone(true)}
      />
      {done ? (
        <button
          type="button"
          onClick={() => router.push("/dashboard/login")}
          style={{
            marginTop: 28,
            alignSelf: "flex-start",
            border: "none",
            borderRadius: 10,
            padding: "10px 18px",
            fontSize: 16,
            fontWeight: 700,
            cursor: "pointer",
            background: "#5fb869",
            color: "#06210b",
          }}
        >
          Continue →
        </button>
      ) : null}
    </div>
  );
}
