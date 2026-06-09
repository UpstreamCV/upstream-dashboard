"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setDemoSceneAction } from "./actions";
import type { DemoScene } from "./scene";

// Drives the two "ambient" demo transitions automatically on a timer once the
// counting line is saved, so the recorder never has to tab-navigate (or touch
// the stepper) to advance the story. Saving the geometry sets the scene to
// `line-saved`; from there this plays out hands-free:
//
//   line-saved → counting   after SAVE_TO_COUNTING_MS (observations start)
//   counting   → problem    after COUNTING_TO_MISS_MS  (a crossing is missed)
//
// Mounted once in the camera detail layout (demo mode only). That layout
// persists across tab navigation, so the timeline keeps running whether the
// recorder is watching Monitor, Observations, or Reliability. It reads the
// current scene as a prop (the layout resolves it server-side); when a timer
// fires it writes the next scene and `router.refresh()` re-renders RSC and
// re-reads the cookie, which advances `currentScene` and arms the next leg.
//
// Everything else still advances from real buttons: Add camera
// (add-camera-panel.tsx), Save geometry (saveGeometryAction → line-saved), and
// Apply fix (suggested-fixes-card.tsx → fixing → fixed).

// Observations begin 3s after Save; the miss lands a few seconds into counting.
const SAVE_TO_COUNTING_MS = 3000;
const COUNTING_TO_MISS_MS = 4000;

function nextLeg(scene: DemoScene): { to: DemoScene; delayMs: number } | null {
  if (scene === "line-saved") {
    return { to: "counting", delayMs: SAVE_TO_COUNTING_MS };
  }
  if (scene === "counting") {
    return { to: "problem", delayMs: COUNTING_TO_MISS_MS };
  }
  return null;
}

export function DemoFlow({ currentScene }: { currentScene: DemoScene }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // Keyed on currentScene: each scene arms exactly one timer for the next leg.
  // When it fires, the scene prop changes, this effect re-runs for the new
  // scene and arms the following leg; the cleanup clears a pending timer if the
  // scene changes another way (e.g. the stepper resets) before it fires.
  useEffect(() => {
    const leg = nextLeg(currentScene);
    if (!leg) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        await setDemoSceneAction(leg.to);
        router.refresh();
      });
    }, leg.delayMs);
    return () => clearTimeout(timer);
  }, [currentScene, router]);

  return null;
}
