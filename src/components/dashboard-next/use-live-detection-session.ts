"use client";

import { useCallback, useEffect, useState } from "react";
import {
  LIVE_SESSION_DURATION_MS,
  isSessionExpired,
} from "@/lib/perception/overlay-helpers";

export type LiveSessionStatus = "off" | "on" | "expired";

export interface LiveDetectionSession {
  status: LiveSessionStatus;
  /** Epoch ms when the session ends; ``null`` when never enabled / turned off. */
  expiresAt: number | null;
  /** Milliseconds left on the session (``0`` when off/expired). */
  remainingMs: number;
  /** Start a fresh 15-minute session. */
  enable: () => void;
  /** End the session immediately (back to ``off``). */
  disable: () => void;
  /** Reset the clock to a fresh 15 minutes from now. */
  extend: () => void;
}

/**
 * Client-side 15-minute "live detections" viewing session (M5). Defaults OFF.
 *
 * The status derives from the absolute ``expiresAt`` timestamp rather than a
 * decrementing counter, so expiry is correct even if the tab was
 * backgrounded/throttled across the boundary (the next render — e.g. on tab
 * re-focus — recomputes it). A 1s tick re-renders the countdown while a session
 * is actively running and stops once it expires or is turned off, so there's no
 * forever-timer. Intentionally NOT persisted to the backend — this is a local,
 * per-tab viewing session.
 */
export function useLiveDetectionSession(
  now: () => number = Date.now,
): LiveDetectionSession {
  const [expiresAt, setExpiresAt] = useState<number | null>(null);
  // Re-render trigger for the live countdown; the stored value is unused.
  const [, setTick] = useState(0);

  const nowMs = now();
  const expired = isSessionExpired(expiresAt, nowMs);
  const status: LiveSessionStatus =
    expiresAt === null ? "off" : expired ? "expired" : "on";
  const remainingMs = expiresAt === null ? 0 : Math.max(0, expiresAt - nowMs);

  // Tick once a second while a session is actively counting down. The tick that
  // crosses expiry flips ``expired`` true, this effect re-runs, and the
  // interval is cleared — no timer survives past expiry or a manual off.
  useEffect(() => {
    if (expiresAt === null || expired) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [expiresAt, expired]);

  const enable = useCallback(
    () => setExpiresAt(now() + LIVE_SESSION_DURATION_MS),
    [now],
  );
  const disable = useCallback(() => setExpiresAt(null), []);
  const extend = useCallback(
    () => setExpiresAt(now() + LIVE_SESSION_DURATION_MS),
    [now],
  );

  return { status, expiresAt, remainingMs, enable, disable, extend };
}
