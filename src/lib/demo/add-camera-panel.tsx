"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Radio, X } from "lucide-react";
import { satoshi } from "@/app/(dash)/fonts";
import { DEMO_TERMINAL_LINES } from "./fixtures";
import { setDemoSceneAction } from "./actions";
import { TerminalLog } from "./terminal-log";

// Part 1: a clean "Add a camera" modal. Shows the agent running in a terminal
// (reusing TerminalLog), then "Detecting camera…" → "✓ connected" and advances
// the demo scene to `connected` so the camera appears in the grid behind it.
type Phase = "running" | "detecting" | "connected";

export function AddCameraPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("running");
  const [, startTransition] = useTransition();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Render through a portal to <body> so the fixed overlay escapes the main
  // panel's containing block. The shell's `.dn-panel` (our parent) has a
  // `backdrop-filter`, which per spec makes it the containing block for
  // position:fixed descendants — so without the portal, `inset:0` resolved to
  // the panel box and only that one container darkened, not the whole page.
  // Mount-gated so createPortal is never called during SSR.
  //
  // The portal lands OUTSIDE the layout's `.dashboard-next` wrapper, so we
  // re-apply that class + the Satoshi font var on the overlay below — otherwise
  // the `--dn-*` tokens and `.dn-*` classes (the card, buttons, text colors)
  // wouldn't resolve and the modal would lose its container / fall back to a
  // system font.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    [],
  );

  const handleTerminalDone = useCallback(() => {
    setPhase("detecting");
    timerRef.current = setTimeout(() => {
      setPhase("connected");
      startTransition(async () => {
        await setDemoSceneAction("connected");
        router.refresh();
      });
    }, 1500);
  }, [router]);

  const overlay = (
    <div
      className={`${satoshi.variable} dashboard-next`}
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        background: "rgba(10,14,9,0.72)",
        backdropFilter: "blur(6px)",
        WebkitBackdropFilter: "blur(6px)",
        display: "grid",
        placeItems: "center",
        padding: "clamp(16px,4vw,48px)",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="dn-tile"
        style={{
          width: "min(680px, 96vw)",
          padding: "clamp(18px,2.4vw,28px)",
          animation: "addCamIn 360ms cubic-bezier(.2,.7,.2,1) both",
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <p className="font-mono" style={{ fontSize: 11, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--dn-text-50)" }}>
              Add a camera
            </p>
            <h2 style={{ fontWeight: 800, fontSize: "clamp(1.1rem,1.6vw,1.45rem)", color: "#000", marginTop: 3 }}>
              Connect Dock Door — Bay 3
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="dn-btn" style={{ padding: 8, borderRadius: 10, lineHeight: 0 }}>
            <X style={{ width: 18, height: 18 }} />
          </button>
        </div>

        <p style={{ color: "var(--dn-text-50)", fontSize: "clamp(0.85rem,1vw,0.95rem)", marginTop: 10 }}>
          Install the agent on the camera host — it registers and starts streaming automatically.
        </p>

        <div
          style={{
            marginTop: 14,
            borderRadius: 14,
            background: "#0b0f0c",
            color: "#fff",
            padding: "clamp(14px,1.8vw,20px)",
            fontSize: "clamp(12px,1.05vw,14px)",
            lineHeight: 1.6,
            minHeight: 168,
            overflow: "hidden",
          }}
        >
          <div style={{ color: "rgba(255,255,255,0.5)", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}>
            $ pip install upstream-agent &amp;&amp; upstream init
          </div>
          <TerminalLog lines={DEMO_TERMINAL_LINES} onDone={handleTerminalDone} />
        </div>

        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 10, minHeight: 40 }}>
          {phase === "running" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--dn-text-50)", fontSize: "0.92rem" }}>
              <Radio style={{ width: 16, height: 16 }} /> Streaming to Upstream…
            </span>
          ) : phase === "detecting" ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#8a6d1f", fontSize: "0.92rem" }}>
              <Loader2 className="animate-spin" style={{ width: 16, height: 16 }} /> Detecting camera…
            </span>
          ) : (
            <>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "#3f7d4e", fontWeight: 700, fontSize: "0.95rem" }}>
                <CheckCircle2 style={{ width: 18, height: 18 }} /> Dock Door — Bay 3 connected
              </span>
              <button
                type="button"
                onClick={onClose}
                className="dn-btn dn-glow-soft"
                style={{ marginLeft: "auto", fontWeight: 700, padding: "8px 16px", borderRadius: 999 }}
              >
                <span className="relative z-10">View camera</span>
              </button>
            </>
          )}
        </div>

        <style>{`@keyframes addCamIn { from { opacity:0; transform: translateY(10px) scale(.985) } to { opacity:1; transform: translateY(0) scale(1) } }`}</style>
      </div>
    </div>
  );

  return mounted ? createPortal(overlay, document.body) : null;
}
