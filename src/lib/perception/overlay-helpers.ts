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
  LatestPerceptionRecord,
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

// --- realtime row mapping ----------------------------------------------------

/**
 * Build a ``LatestPerceptionRecord`` from a Supabase Realtime ``postgres_changes``
 * row (the ``new`` payload for an INSERT/UPDATE on latest_perception_snapshots).
 *
 * Lets the live overlay update its SWR cache directly from the broadcast row —
 * sanctioned by AGENTS.md as a "local state update derived from the broadcast
 * row" — instead of triggering a refetch. A refetch goes through SWR's
 * dedupingInterval and coalesces rapid updates down to ~1/s; a direct cache
 * write does not, so detections render at the rate the processor publishes
 * (~3/s) rather than the dedupe-throttled rate.
 *
 * Returns ``null`` when the row lacks the identity/timestamp fields the overlay
 * needs — the caller then falls back to a normal refetch. The snapshot JSONB
 * arrives already parsed from the realtime client. No secrets live in this row
 * (ids + perception objects + geometry only); ``account_id`` is intentionally
 * dropped.
 */
export function perceptionRecordFromRealtimeRow(
  row: unknown,
): LatestPerceptionRecord | null {
  if (!isRecord(row)) return null;
  const id = nonEmptyStr(row.id);
  const cameraId = nonEmptyStr(row.camera_id);
  const observedAt = nonEmptyStr(row.observed_at);
  if (id === null || cameraId === null || observedAt === null) return null;
  // The snapshot JSONB is opaque/untrusted; normalizeSnapshot() coerces it
  // downstream, so an unknown shape here is fine. Cast through unknown.
  const snapshot = isRecord(row.snapshot) ? row.snapshot : {};
  return {
    id,
    camera_id: cameraId,
    stream_session_id: nonEmptyStr(row.stream_session_id) ?? "",
    processor_id: nonEmptyStr(row.processor_id),
    package_id: nonEmptyStr(row.package_id),
    observed_at: observedAt,
    updated_at: nonEmptyStr(row.updated_at) ?? observedAt,
    snapshot: snapshot as unknown as LatestPerceptionRecord["snapshot"],
  };
}

// --- perception-fanout WS message mapping ------------------------------------

/**
 * Build a ``LatestPerceptionRecord`` from a perception-fanout WS ``snapshot``
 * frame (see ``src/lib/perception/perception-ws-client.ts``). Same role as
 * ``perceptionRecordFromRealtimeRow`` for the Supabase path: lets the live
 * overlay write each 10–15 Hz frame straight into the SWR cache so the SVG
 * renderer is reused unchanged.
 *
 * The WS envelope has no DB row id (the hot path never touches the DB), so a
 * synthetic ``ws:<camera_id>:<seq>`` id keeps records distinguishable, and
 * ``updated_at`` mirrors ``observed_at``. Returns ``null`` when the envelope
 * lacks identity/timestamp fields — the caller just drops that frame (the
 * next one is ≤100ms away).
 */
export function perceptionRecordFromWsMessage(
  msg: unknown,
): LatestPerceptionRecord | null {
  if (!isRecord(msg) || msg.type !== "snapshot") return null;
  const cameraId = nonEmptyStr(msg.camera_id);
  const observedAt = nonEmptyStr(msg.observed_at);
  const seq = finiteNum(msg.seq);
  if (cameraId === null || observedAt === null || seq === null) return null;
  const snapshot = isRecord(msg.snapshot) ? msg.snapshot : {};
  return {
    id: `ws:${cameraId}:${seq}`,
    camera_id: cameraId,
    stream_session_id: nonEmptyStr(msg.stream_session_id) ?? "",
    processor_id: nonEmptyStr(msg.processor_id),
    package_id: nonEmptyStr(msg.package_id),
    observed_at: observedAt,
    updated_at: observedAt,
    snapshot: snapshot as unknown as LatestPerceptionRecord["snapshot"],
  };
}

// --- age / staleness ---------------------------------------------------------

/** Seconds between ``observedAt`` and ``now``. ``null`` when the input is
 * unparseable. Positive when ``observedAt`` is in the past (the normal case);
 * negative when somehow ahead of ``now``. */
export function observedAtAgeSeconds(
  observedAt: string | null | undefined,
  now: number,
): number | null {
  if (typeof observedAt !== "string" || observedAt.length === 0) return null;
  const ms = Date.parse(observedAt);
  if (!Number.isFinite(ms)) return null;
  return (now - ms) / 1000;
}

/**
 * Honest one-line age label for the live overlay.
 *
 *   age < 60s   -> "overlay 0.8s old"   (single decimal, matches polling cadence)
 *   age >= 60s  -> "overlay 5 min old"  (rounded; we hand off to coarser units)
 *
 * Returning ``null`` lets the caller fall back to RelativeTime or omit the
 * line entirely when there's no observation to age.
 */
export function formatOverlayAge(
  observedAt: string | null | undefined,
  now: number,
): string | null {
  const age = observedAtAgeSeconds(observedAt, now);
  if (age === null) return null;
  // Future-clock or sub-second precision; clamp to 0 so we don't print
  // "overlay -0.2s old" if the local clock is briefly ahead of the server.
  const clamped = Math.max(0, age);
  if (clamped < 60) return `overlay ${clamped.toFixed(1)}s old`;
  if (clamped < 3600) return `overlay ${Math.round(clamped / 60)} min old`;
  return `overlay ${Math.round(clamped / 3600)} h old`;
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

// --- M5: free-plan-safe live-detections session + realtime gating -----------
//
// On the Supabase Free plan a Realtime subscription held open by every Monitor
// tab is wasteful. M5 makes the subscription intentional: detections are OFF by
// default, the user opts into a time-boxed viewing session, and the gate below
// keeps the subscription open ONLY while it's useful. These helpers are pure so
// the gating + countdown logic is exhaustively unit-testable without React.

/** A live-detections viewing session lasts 15 minutes (see M5). */
export const LIVE_SESSION_DURATION_MS = 15 * 60 * 1000;

/**
 * True once a live-detections session has passed its expiry. Computed from the
 * absolute ``expiresAt`` timestamp (not a ticking counter) so a throttled or
 * backgrounded tab reports the correct state the instant it wakes. A ``null``
 * expiry (never enabled / manually turned off) is never expired.
 */
export function isSessionExpired(
  expiresAt: number | null,
  now: number,
): boolean {
  return expiresAt !== null && now >= expiresAt;
}

/** ``mm:ss`` for a remaining-milliseconds value; clamps negatives to ``00:00``. */
export function formatCountdown(remainingMs: number): string {
  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Inputs deciding whether the live overlay holds a Supabase Realtime
 * subscription open. We subscribe only while ALL hold, so an idle / hidden /
 * disabled / stale / unenabled overlay consumes no realtime connection.
 * ``processorOutputFresh`` is ``!isStale`` — "no snapshot yet" counts as fresh
 * so the very first event can still arrive.
 */
export interface RealtimeGateInput {
  liveDetectionsEnabled: boolean;
  isExpired: boolean;
  streamActive: boolean;
  processingEnabled: boolean;
  processorOutputFresh: boolean;
  pageVisible: boolean;
}

export function computeRealtimeGate(input: RealtimeGateInput): boolean {
  return (
    input.liveDetectionsEnabled &&
    !input.isExpired &&
    input.streamActive &&
    input.processingEnabled &&
    input.processorOutputFresh &&
    input.pageVisible
  );
}

/** Supabase channel ``.subscribe()`` status values we care about (``null`` =
 * subscribe requested, no status yet). */
export type RealtimeStatus =
  | "SUBSCRIBED"
  | "CHANNEL_ERROR"
  | "TIMED_OUT"
  | "CLOSED"
  | null;

/** The single user-facing mode shown in the overlay connection chip. */
export type OverlayConnectionMode =
  | "expired"
  | "off"
  | "processing_disabled"
  | "stream_inactive"
  | "processor_stale"
  | "connecting"
  | "ws_connected"
  | "connected"
  | "reconnecting"
  | "fallback_polling";

const OVERLAY_CONNECTION_LABELS: Record<OverlayConnectionMode, string> = {
  expired: "Live detections expired",
  off: "Live detections off",
  processing_disabled: "Processing disabled",
  stream_inactive: "Stream inactive",
  processor_stale: "Processor stale",
  connecting: "Connecting",
  ws_connected: "Live stream connected",
  connected: "Realtime connected",
  reconnecting: "Reconnecting",
  fallback_polling: "Fallback polling",
};

export interface ConnectionStateInput {
  processingEnabled: boolean;
  liveDetectionsEnabled: boolean;
  isExpired: boolean;
  streamActive: boolean;
  isStale: boolean;
  shouldUseRealtime: boolean;
  realtimeStatus: RealtimeStatus;
  // Whether a realtime row event has actually arrived recently. A channel can
  // report SUBSCRIBED yet deliver nothing (e.g. the table isn't in the
  // supabase_realtime publication in this environment); in that case the poll
  // fallback is what's really driving the overlay, so we say so.
  realtimeDelivering: boolean;
  // Whether the perception-fanout WS hot path delivered a frame recently.
  // Mirrors realtimeDelivering: "connected" claims require evidence of actual
  // frames, never just an open socket. Wins over the Realtime modes — when
  // both paths deliver, the WS path (10–15 Hz) is the one driving the overlay.
  wsDelivering: boolean;
}

/**
 * Derive the overlay connection chip's ``{ mode, label }``. Priority reflects
 * the user's intent first (off / expired session) and then, once they've opted
 * in, the biggest blocker (processing → stream → freshness) before surfacing
 * the live realtime status. ``page hidden`` is intentionally NOT a mode — the
 * user can't see the chip then anyway.
 */
export function deriveOverlayConnectionState(input: ConnectionStateInput): {
  mode: OverlayConnectionMode;
  label: string;
} {
  const mode = pickConnectionMode(input);
  return { mode, label: OVERLAY_CONNECTION_LABELS[mode] };
}

function pickConnectionMode(i: ConnectionStateInput): OverlayConnectionMode {
  if (i.isExpired) return "expired";
  if (!i.liveDetectionsEnabled) return "off";
  if (!i.processingEnabled) return "processing_disabled";
  if (!i.streamActive) return "stream_inactive";
  if (i.isStale) return "processor_stale";
  // The WS hot path delivering frames outranks every Realtime state: it is
  // strictly fresher (10–15 Hz vs ~1 Hz) and carries the overlay on its own.
  if (i.wsDelivering) return "ws_connected";
  if (i.shouldUseRealtime) {
    if (i.realtimeStatus === "SUBSCRIBED") {
      // Subscribed AND actually receiving events -> truly live. Subscribed but
      // silent -> the poll fallback is doing the work; don't claim "connected".
      return i.realtimeDelivering ? "connected" : "fallback_polling";
    }
    if (
      i.realtimeStatus === "CHANNEL_ERROR" ||
      i.realtimeStatus === "TIMED_OUT"
    ) {
      return "reconnecting";
    }
    if (i.realtimeStatus === null) return "connecting";
    // CLOSED — the channel is gone; the poll fallback carries the overlay.
    return "fallback_polling";
  }
  return "fallback_polling";
}
