"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  coerceScene,
  DEFAULT_SCENE,
  DEMO_SCENES,
  nextScene,
  prevScene,
  sceneIndex,
  type DemoScene,
} from "./scene";
import { setDemoSceneAction } from "./actions";
import { MOOD_PRESENTATION, SCENE_META } from "./scene-meta";

// Floating scene control — ONLY mounted when demo mode is on (the (app) layout
// gates it behind isDemoMode()). It is NOT needed to run the demo: the narrative
// now advances entirely from real product actions (Add camera, Save geometry,
// Apply fix) and tab navigation (see demo-flow.tsx). This is only a take-saving
// fallback, so it stays HIDDEN by default — never in the recording frame. Press
// the backtick key (`) to toggle it into view; ◀ / ▶ and keys [ and ] jump to
// any beat and keep working even while it's hidden. Reads the current scene from
// the non-httpOnly `demo_scene` cookie; also applies a one-time ?demoScene= URL
// override so you can deep-link straight to a beat.

function readSceneCookie(): DemoScene {
  if (typeof document === "undefined") return DEFAULT_SCENE;
  const m = document.cookie.match(/(?:^|;\s*)demo_scene=([^;]+)/);
  return coerceScene(m ? decodeURIComponent(m[1]) : undefined);
}

export function DemoStepper() {
  const router = useRouter();
  const [scene, setScene] = useState<DemoScene>(DEFAULT_SCENE);
  const [mounted, setMounted] = useState(false);
  // Hidden by default so it's never in the recording frame; backtick toggles it.
  const [visible, setVisible] = useState(false);
  const [, startTransition] = useTransition();

  const apply = useCallback(
    (target: DemoScene) => {
      setScene(target);
      startTransition(async () => {
        await setDemoSceneAction(target);
        router.refresh();
      });
    },
    [router],
  );

  // On mount: seed from a ?demoScene= override if present, else the cookie.
  // Deferred to a timeout so the setState runs in a callback (not synchronously
  // in the effect body) — satisfies react-hooks/set-state-in-effect, and lands
  // after hydration so the client-only cookie read can't cause a mismatch.
  useEffect(() => {
    const override = new URLSearchParams(window.location.search).get("demoScene");
    const initial = override ? coerceScene(override) : readSceneCookie();
    const t = setTimeout(() => {
      setScene(initial);
      setMounted(true);
      if (override) {
        startTransition(async () => {
          await setDemoSceneAction(initial);
          router.refresh();
        });
      }
    }, 0);
    return () => clearTimeout(t);
  }, [router]);

  // Keyboard: [ = prev, ] = next (ignored while typing in a field).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === "]") apply(nextScene(scene));
      else if (e.key === "[") apply(prevScene(scene));
      else if (e.key === "`") setVisible((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [scene, apply]);

  // Hidden until mounted (avoids SSR/client cookie mismatch) AND until the
  // recorder reveals it with backtick — it's a fallback, not part of the take.
  if (!mounted || !visible) return null;

  const idx = sceneIndex(scene);
  const accent = MOOD_PRESENTATION[SCENE_META[scene].mood].accent;
  const btn: React.CSSProperties = {
    border: "none",
    borderRadius: 8,
    padding: "4px 10px",
    fontSize: 14,
    fontWeight: 700,
    cursor: "pointer",
    background: "rgba(255,255,255,0.14)",
    color: "#fff",
    lineHeight: 1.4,
  };

  return (
    <div
      data-demo-stepper
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 10px",
        borderRadius: 12,
        background: "rgba(15,20,14,0.92)",
        boxShadow: "0 10px 30px -8px rgba(0,0,0,0.6)",
        color: "#fff",
        font: "500 13px/1.2 ui-monospace, monospace",
        userSelect: "none",
      }}
    >
      <span style={{ opacity: 0.6 }}>demo</span>
      <button type="button" style={btn} onClick={() => apply(prevScene(scene))} aria-label="Previous scene">◀</button>
      <span style={{ minWidth: 156, textAlign: "center" }}>
        <span style={{ fontWeight: 700, color: accent }}>{SCENE_META[scene].title}</span>
        <span style={{ opacity: 0.5 }}> · {idx + 1}/{DEMO_SCENES.length}</span>
      </span>
      <button type="button" style={btn} onClick={() => apply(nextScene(scene))} aria-label="Next scene">▶</button>
      <button
        type="button"
        style={{ ...btn, background: "transparent", opacity: 0.6 }}
        onClick={() => apply(DEFAULT_SCENE)}
        aria-label="Reset scene"
      >
        reset
      </button>
    </div>
  );
}
