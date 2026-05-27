// Pure helpers for the perception overlay — no React, no I/O, so they stay
// importable from both server code, client overlays, and node-environment
// vitest. Shared between the legacy /dashboard and the new /dashboard-next
// segments; previously lived under src/app/dashboard/cameras/[cameraId]/.
//
// The perception snapshot payload is stored server-side as opaque JSONB; the
// api-server validates only the envelope, never the nested objects/geometry.
// Everything here treats the payload as untrusted: it coerces field-by-field
// and never throws on a malformed shape.

import type {
  PerceptionBBox,
  PerceptionGeometryLine,
  PerceptionGeometryRoi,
  PerceptionObject,
  PerceptionPoint,
} from "@/lib/api/types";

/** Proxy-relative path for the P5-C latest-perception endpoint. */
export function buildLatestPerceptionPath(cameraId: string): string {
  return `/v1/cameras/${cameraId}/perception/latest`;
}

/** Confidence-threshold options for the overlay filter dropdown (0 = show all). */
export const CONFIDENCE_THRESHOLDS: readonly number[] = [0, 0.25, 0.5, 0.75];

/**
 * Overlay colors. The backend owns *facts* (coordinates, labels, track ids);
 * the frontend owns *presentation*. Picked for contrast against a typical
 * camera frame and harmonized with the dashboard's brand tokens.
 */
export const OVERLAY_COLORS = {
  box: "#5fb869",
  boxLabelBg: "rgba(15, 24, 9, 0.82)",
  boxLabelText: "#f5f1e7",
  roiStroke: "#c8d9b6",
  roiFill: "rgba(200, 217, 182, 0.16)",
  roiLabel: "#e7eedd",
  line: "#e8c06b",
  lineLabel: "#f1d79a",
  labelHalo: "#0f1809",
} as const;

// --- low-level coercion ------------------------------------------------------

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

function finiteNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

function nonEmptyStr(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function coerceBBox(v: unknown): PerceptionBBox | null {
  if (!isRecord(v)) return null;
  const x = finiteNum(v.x);
  const y = finiteNum(v.y);
  const w = finiteNum(v.w);
  const h = finiteNum(v.h);
  if (x === null || y === null || w === null || h === null) return null;
  return { x, y, w, h };
}

function coercePoints(v: unknown): PerceptionPoint[] {
  if (!Array.isArray(v)) return [];
  const out: PerceptionPoint[] = [];
  for (const p of v) {
    if (!isRecord(p)) continue;
    const x = finiteNum(p.x);
    const y = finiteNum(p.y);
    if (x === null || y === null) continue;
    out.push({ x, y });
  }
  return out;
}

function coerceGeometry(v: unknown, kind: string): PerceptionGeometryRoi[] {
  if (!Array.isArray(v)) return [];
  const out: PerceptionGeometryRoi[] = [];
  v.forEach((item, idx) => {
    if (!isRecord(item)) return;
    const points = coercePoints(item.points);
    if (points.length === 0) return;
    out.push({
      id: nonEmptyStr(item.id) ?? `${kind}-${idx}`,
      label: nonEmptyStr(item.label),
      points,
    });
  });
  return out;
}

function coerceObjects(v: unknown): PerceptionObject[] {
  if (!Array.isArray(v)) return [];
  const out: PerceptionObject[] = [];
  for (const item of v) {
    if (!isRecord(item)) continue;
    out.push({
      track_id: nonEmptyStr(item.track_id),
      class_id: finiteNum(item.class_id),
      label: nonEmptyStr(item.label),
      confidence: finiteNum(item.confidence),
      bbox: coerceBBox(item.bbox),
      bbox_normalized: coerceBBox(item.bbox_normalized),
      roi_labels: Array.isArray(item.roi_labels)
        ? item.roi_labels.filter((r): r is string => nonEmptyStr(r) !== null)
        : [],
    });
  }
  return out;
}

// --- normalized snapshot -----------------------------------------------------

export interface NormalizedSnapshot {
  frameWidth: number | null;
  frameHeight: number | null;
  frameNum: number | null;
  fps: number | null;
  objects: PerceptionObject[];
  rois: PerceptionGeometryRoi[];
  lines: PerceptionGeometryLine[];
}

/**
 * Coerce a raw (JSONB, possibly-malformed) perception payload into safe,
 * fully-typed arrays. Never throws — a garbage payload yields empty arrays and
 * null dimensions, which the overlay renders as an empty/warning state.
 */
export function normalizeSnapshot(payload: unknown): NormalizedSnapshot {
  const root = isRecord(payload) ? payload : {};
  const frame = isRecord(root.frame) ? root.frame : {};
  const geometry = isRecord(root.geometry) ? root.geometry : {};
  const width = finiteNum(frame.width);
  const height = finiteNum(frame.height);
  return {
    frameWidth: width !== null && width > 0 ? width : null,
    frameHeight: height !== null && height > 0 ? height : null,
    frameNum: finiteNum(frame.frame_num),
    fps: finiteNum(frame.fps),
    objects: coerceObjects(root.objects),
    rois: coerceGeometry(geometry.rois, "roi"),
    lines: coerceGeometry(geometry.lines, "line"),
  };
}

/** True when the snapshot carries usable frame dimensions for a viewBox. */
export function hasFrameDimensions(s: NormalizedSnapshot): boolean {
  return s.frameWidth !== null && s.frameHeight !== null;
}

// --- bounding boxes ----------------------------------------------------------

/**
 * Resolve an object's drawable pixel bounding box. Prefers the pixel `bbox`;
 * falls back to converting `bbox_normalized` (0..1) with the frame dimensions.
 * Returns `null` when neither is usable — the caller skips drawing that object.
 */
export function resolveBBox(
  obj: PerceptionObject,
  frameWidth: number | null,
  frameHeight: number | null,
): PerceptionBBox | null {
  const pixel = coerceBBox(obj.bbox);
  if (pixel) return pixel;
  const norm = coerceBBox(obj.bbox_normalized);
  if (norm && frameWidth && frameHeight) {
    return {
      x: norm.x * frameWidth,
      y: norm.y * frameHeight,
      w: norm.w * frameWidth,
      h: norm.h * frameHeight,
    };
  }
  return null;
}

export interface OverlayObject {
  object: PerceptionObject;
  box: PerceptionBBox;
}

/**
 * The objects that will actually be drawn: those that survive the confidence
 * threshold (objects with no confidence are kept — an unknown isn't a "below")
 * and have a resolvable bounding box. Shared by the SVG renderer and the
 * client component's "no objects" messaging so the two never disagree.
 */
export function selectOverlayObjects(
  objects: PerceptionObject[],
  frameWidth: number | null,
  frameHeight: number | null,
  minConfidence: number,
): OverlayObject[] {
  const out: OverlayObject[] = [];
  for (const object of objects) {
    if (
      minConfidence > 0 &&
      typeof object.confidence === "number" &&
      object.confidence < minConfidence
    ) {
      continue;
    }
    const box = resolveBBox(object, frameWidth, frameHeight);
    if (!box) continue;
    out.push({ object, box });
  }
  return out;
}

// --- labels ------------------------------------------------------------------

/** `0.423` -> `"42%"`; non-finite / missing -> `null`. */
export function confidencePercent(
  confidence: number | null | undefined,
): string | null {
  if (typeof confidence !== "number" || !Number.isFinite(confidence)) {
    return null;
  }
  return `${Math.round(confidence * 100)}%`;
}

/** Human name for an object: `label`, else `class N`, else `object`. */
export function objectName(obj: PerceptionObject): string {
  const label = nonEmptyStr(obj.label);
  if (label) return label;
  const classId = finiteNum(obj.class_id ?? null);
  if (classId !== null) return `class ${classId}`;
  return "object";
}

/**
 * One-line object label, e.g. `person #3 · 42%` or, with `showRoi`,
 * `person #3 · entry-roi · 42%`. Fully defensive: a missing label, track id or
 * confidence simply drops that segment.
 */
export function formatObjectLabel(
  obj: PerceptionObject,
  opts: { showRoi?: boolean } = {},
): string {
  let head = objectName(obj);
  const track = nonEmptyStr(obj.track_id);
  if (track) head += ` #${track}`;

  const parts = [head];
  if (opts.showRoi && Array.isArray(obj.roi_labels)) {
    const rois = obj.roi_labels.filter((r) => nonEmptyStr(r) !== null);
    if (rois.length > 0) parts.push(rois.join(", "));
  }
  const pct = confidencePercent(obj.confidence);
  if (pct) parts.push(pct);
  return parts.join(" · ");
}

// --- geometry rendering helpers ---------------------------------------------

/** SVG `points` attribute string for a polygon/polyline. */
export function pointsToAttr(points: PerceptionPoint[]): string {
  return points.map((p) => `${p.x},${p.y}`).join(" ");
}

/** Arithmetic mean of a point set — used to place ROI labels. */
export function centroid(points: PerceptionPoint[]): PerceptionPoint | null {
  if (points.length === 0) return null;
  let sx = 0;
  let sy = 0;
  for (const p of points) {
    sx += p.x;
    sy += p.y;
  }
  return { x: sx / points.length, y: sy / points.length };
}
