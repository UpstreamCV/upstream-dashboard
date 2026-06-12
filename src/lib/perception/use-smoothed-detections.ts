"use client";

// React side of the overlay smoothing (see overlay-smoothing.ts for the pure
// state machine + tuning constants). Raw selections come in whenever the SWR
// cache updates (WS hot path at 10-15 Hz, Realtime, or the poll); a
// requestAnimationFrame loop advances the display boxes at browser render
// speed and STOPS itself once everything has converged and no grace fade is
// active — an idle scene costs zero animation frames. Frames are cancelled on
// unmount/disable.
//
// IMPORTANT: `rawObjects` must be referentially stable across re-renders that
// don't carry new data (memoize it on the snapshot identity in the caller) —
// the effect keys on it to detect real updates.

import { useEffect, useMemo, useRef, useState } from "react";
import type { OverlayObject } from "./overlay-helpers";
import {
  DetectionSmoother,
  ENABLE_OVERLAY_SMOOTHING,
  passthroughDisplayObjects,
  type DisplayOverlayObject,
} from "./overlay-smoothing";

export function useSmoothedDetections(
  rawObjects: OverlayObject[],
  enabled: boolean,
  now: () => number = Date.now,
): DisplayOverlayObject[] {
  const active = ENABLE_OVERLAY_SMOOTHING && enabled;
  const smootherRef = useRef<DetectionSmoother | null>(null);
  const [smoothed, setSmoothed] = useState<DisplayOverlayObject[]>([]);

  // Disabled path: identical to the pre-smoothing render, no rAF, no state.
  const passthrough = useMemo(
    () => passthroughDisplayObjects(rawObjects),
    [rawObjects],
  );

  useEffect(() => {
    if (!active) {
      smootherRef.current = null;
      return;
    }
    const smoother = (smootherRef.current ??= new DetectionSmoother());
    smoother.setTargets(rawObjects, now());
    // Always take at least one step (so the new targets are drawn even when
    // already converged), then keep stepping until the smoother reports
    // rest. The first paint waits one animation frame (~16 ms) — invisible,
    // and it keeps state updates out of the effect body (react-hooks rule).
    let raf = requestAnimationFrame(function tick() {
      raf = 0;
      setSmoothed(smoother.sample(now()));
      if (smoother.hasPendingMotion()) raf = requestAnimationFrame(tick);
    });
    return () => {
      if (raf) cancelAnimationFrame(raf);
    };
  }, [rawObjects, active, now]);

  // Until the first animation frame has sampled (e.g. the very first render
  // after data arrives), fall back to the raw boxes so the overlay never
  // blanks while waiting ~16 ms for rAF. Safe: whenever raw targets exist
  // the smoother's output includes them, so "smoothed empty + raw present"
  // can only mean "no sample yet".
  if (active && smoothed.length === 0 && rawObjects.length > 0) {
    return passthrough;
  }
  return active ? smoothed : passthrough;
}
