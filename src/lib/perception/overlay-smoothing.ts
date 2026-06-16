// Display-only smoothing for the live overlay's detection boxes.
//
// The perception-fanout WS hot path delivers raw snapshots at ~10-15 Hz and
// the SVG renderer draws whatever the latest snapshot says — which is
// truthful but visually snappy: boxes jump between updates and flicker out
// on a single missed detection. This module interpolates a *display* copy of
// each tracked box toward its latest raw target so boxes glide at render
// speed, holds briefly-missing tracks through a short fading grace window,
// and lightly smooths the confidence figure shown in the label.
//
// HARD RULE — presentation only. The raw snapshot in the SWR cache remains
// the source of truth: object counts, analytics, observations, alerts, and
// every backend fact are untouched. Disable everything with
// `ENABLE_OVERLAY_SMOOTHING = false` (rendering then falls back to the raw
// per-update behavior, no animation frames at all).
//
// Pure + time-injected (no Date.now, no React, no rAF in here) so the whole
// state machine is unit-testable. The React side lives in
// `use-smoothed-detections.ts`.

import type { PerceptionBBox, PerceptionObject } from "@/lib/api/types";
import type { OverlayObject } from "./overlay-helpers";

// --- tuning constants ---------------------------------------------------

/** Master switch. `false` = raw behavior, zero animation frames. */
export const ENABLE_OVERLAY_SMOOTHING = true;

/** Box lerp factor per 60 Hz reference frame: display += a * (target - display).
 * Higher = snappier (1 = no smoothing), lower = floatier. */
export const BOX_SMOOTHING_ALPHA = 0.35;

/** EMA factor for the confidence figure in the visible label (applied once
 * per raw update, not per animation frame). Display-only. */
export const CONFIDENCE_SMOOTHING_ALPHA = 0.25;

/** How long a box that vanished from the latest update stays visible while
 * fading out. Covers single missed detections without inventing presence. */
export const DISAPPEAR_GRACE_MS = 300;

/** Alpha is defined per 60 Hz frame; samples are normalized to this so a
 * 120 Hz or 30 Hz display converges at the same wall-clock speed. */
const REFERENCE_FRAME_MS = 1000 / 60;

/** Once every box dimension is within this many frame-pixels of its target,
 * the box snaps to the target and stops animating. */
const CONVERGENCE_EPSILON_PX = 0.5;

/** Clamp on per-sample dt so a backgrounded tab doesn't "catch up" with one
 * giant step when rAF resumes. */
const MAX_SAMPLE_DT_MS = 100;

// --- types ----------------------------------------------------------------

/** One renderable box: the raw selection shape plus a stable render key and
 * a display opacity (fades during the disappearance grace window). */
export interface DisplayOverlayObject extends OverlayObject {
  key: string;
  opacity: number;
}

interface TrackEntry {
  /** Latest raw box — always the truth we converge toward. */
  target: PerceptionBBox;
  /** The interpolated box actually drawn. */
  display: PerceptionBBox;
  /** Latest raw object (label, roi_labels, …) with NO confidence rewrite. */
  object: PerceptionObject;
  /** EMA of confidence for the visible label only. */
  displayConfidence: number | null;
  missingSinceMs: number | null;
  insertedAt: number; // stable ordering for render output
}

function trackKey(object: PerceptionObject): string | null {
  const id = object.track_id;
  return typeof id === "string" && id !== "" ? id : null;
}

function lerpBox(
  display: PerceptionBBox,
  target: PerceptionBBox,
  alpha: number,
): PerceptionBBox {
  const next = {
    x: display.x + alpha * (target.x - display.x),
    y: display.y + alpha * (target.y - display.y),
    w: display.w + alpha * (target.w - display.w),
    h: display.h + alpha * (target.h - display.h),
  };
  if (
    Math.abs(next.x - target.x) < CONVERGENCE_EPSILON_PX &&
    Math.abs(next.y - target.y) < CONVERGENCE_EPSILON_PX &&
    Math.abs(next.w - target.w) < CONVERGENCE_EPSILON_PX &&
    Math.abs(next.h - target.h) < CONVERGENCE_EPSILON_PX
  ) {
    return { ...target };
  }
  return next;
}

function boxConverged(display: PerceptionBBox, target: PerceptionBBox): boolean {
  return (
    display.x === target.x &&
    display.y === target.y &&
    display.w === target.w &&
    display.h === target.h
  );
}

// --- the smoother -----------------------------------------------------------

export class DetectionSmoother {
  private tracks = new Map<string, TrackEntry>();
  /** Objects without a usable track_id: no identity to smooth against, so
   * they pass through raw (the brief: avoid aggressive smoothing). */
  private untracked: OverlayObject[] = [];
  private lastSampleAtMs: number | null = null;
  private insertCounter = 0;

  /** Feed the latest raw selection (one call per WS/poll update). */
  setTargets(objects: OverlayObject[], nowMs: number): void {
    const seen = new Set<string>();
    this.untracked = [];
    for (const raw of objects) {
      const key = trackKey(raw.object);
      if (key === null) {
        this.untracked.push(raw);
        continue;
      }
      seen.add(key);
      const existing = this.tracks.get(key);
      if (existing) {
        existing.target = { ...raw.box };
        existing.object = raw.object;
        existing.missingSinceMs = null;
        const c = raw.object.confidence;
        if (typeof c === "number" && Number.isFinite(c)) {
          existing.displayConfidence =
            existing.displayConfidence === null
              ? c
              : existing.displayConfidence +
                CONFIDENCE_SMOOTHING_ALPHA * (c - existing.displayConfidence);
        }
      } else {
        // New track: appear AT its first position (no fly-in animation).
        const c = raw.object.confidence;
        this.tracks.set(key, {
          target: { ...raw.box },
          display: { ...raw.box },
          object: raw.object,
          displayConfidence:
            typeof c === "number" && Number.isFinite(c) ? c : null,
          missingSinceMs: null,
          insertedAt: this.insertCounter++,
        });
      }
    }
    for (const [key, entry] of this.tracks) {
      if (seen.has(key)) continue;
      if (entry.missingSinceMs === null) {
        entry.missingSinceMs = nowMs;
      } else if (nowMs - entry.missingSinceMs > DISAPPEAR_GRACE_MS) {
        this.tracks.delete(key); // grace elapsed — no stale entries linger
      }
    }
  }

  /** One animation-frame step: advance display boxes toward targets and
   * return what to draw right now. */
  sample(nowMs: number): DisplayOverlayObject[] {
    const dt =
      this.lastSampleAtMs === null
        ? REFERENCE_FRAME_MS
        : Math.min(Math.max(nowMs - this.lastSampleAtMs, 0), MAX_SAMPLE_DT_MS);
    this.lastSampleAtMs = nowMs;
    // Frame-rate-independent lerp: BOX_SMOOTHING_ALPHA is "per 60 Hz frame".
    const alpha = 1 - Math.pow(1 - BOX_SMOOTHING_ALPHA, dt / REFERENCE_FRAME_MS);

    const out: DisplayOverlayObject[] = [];
    const ordered = [...this.tracks.entries()].sort(
      (a, b) => a[1].insertedAt - b[1].insertedAt,
    );
    for (const [key, entry] of ordered) {
      let opacity = 1;
      if (entry.missingSinceMs !== null) {
        const elapsed = nowMs - entry.missingSinceMs;
        if (elapsed > DISAPPEAR_GRACE_MS) {
          this.tracks.delete(key);
          continue;
        }
        opacity = Math.max(0, 1 - elapsed / DISAPPEAR_GRACE_MS);
      }
      entry.display = lerpBox(entry.display, entry.target, alpha);
      out.push({
        key,
        opacity,
        box: entry.display,
        // The confidence rewrite feeds ONLY the visible label; the raw
        // object in the snapshot/cache is never touched.
        object:
          entry.displayConfidence === null
            ? entry.object
            : { ...entry.object, confidence: entry.displayConfidence },
      });
    }
    for (const [idx, raw] of this.untracked.entries()) {
      out.push({ key: `untracked-${idx}`, opacity: 1, ...raw });
    }
    return out;
  }

  /** True while anything is still animating (unconverged box or an active
   * grace fade) — lets the render loop stop when the scene is at rest. */
  hasPendingMotion(): boolean {
    for (const entry of this.tracks.values()) {
      if (entry.missingSinceMs !== null) return true;
      if (!boxConverged(entry.display, entry.target)) return true;
    }
    return false;
  }

  reset(): void {
    this.tracks.clear();
    this.untracked = [];
    this.lastSampleAtMs = null;
  }
}

/** Raw pass-through shape used when smoothing is disabled — identical render
 * output to the pre-smoothing behavior. */
export function passthroughDisplayObjects(
  objects: OverlayObject[],
): DisplayOverlayObject[] {
  return objects.map((raw, idx) => ({
    key: trackKey(raw.object) ?? `untracked-${idx}`,
    opacity: 1,
    ...raw,
  }));
}
