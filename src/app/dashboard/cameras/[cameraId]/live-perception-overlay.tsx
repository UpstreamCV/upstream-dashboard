"use client";

import { useState } from "react";
import { Boxes, RefreshCw, Spline, Tag } from "lucide-react";
import clsx from "clsx";
import { RelativeTime } from "@/components/data/relative-time";
import { LiveStreamPlayer } from "@/components/stream/live-stream-player";
import { UpstreamApiError } from "@/lib/api/errors";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  LatestPerceptionRecord,
  LatestPerceptionResponse,
  StreamParams,
} from "@/lib/api/types";
import {
  CONFIDENCE_THRESHOLDS,
  buildLatestPerceptionPath,
  hasFrameDimensions,
  normalizeSnapshot,
  selectOverlayObjects,
} from "./perception-overlay";
import { PerceptionOverlaySvg } from "./perception-overlay-svg";

// Polled snapshot cadence while the overlay is live. This is a practical
// first-version overlay: the snapshot is whatever the processor last upserted
// (~1 FPS in P5-C), so the overlay can lag the video by up to this interval
// plus network latency. It is NOT frame-synchronized metadata.
const LIVE_OVERLAY_POLL_MS = 2_000;

/**
 * P5-E — live stream overlay. Draws the latest P5-C perception snapshot over
 * the live WebRTC video by reusing the P5-D `PerceptionOverlaySvg` renderer and
 * helpers. It wraps the existing `<LiveStreamPlayer />` and feeds the SVG into
 * the player's generic `overlay` slot — there is exactly one WebRTC connection.
 *
 * The overlay polls the snapshot endpoint; it does not stream frame-synced
 * metadata. The latest-frame overlay (P5-D) is untouched and still present.
 */
export function LivePerceptionOverlay({
  sessionId,
  cameraId,
  approved,
  initialPerception,
}: {
  sessionId: string;
  cameraId: string;
  approved: StreamParams;
  initialPerception: LatestPerceptionRecord | null;
}) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showGeometry, setShowGeometry] = useState(true);
  const [minConfidence, setMinConfidence] = useState(0);
  const [live, setLive] = useState(true);

  const { data, error, isValidating, mutate } =
    useUpstreamList<LatestPerceptionResponse>(
      buildLatestPerceptionPath(cameraId),
      {
        refreshInterval: live ? LIVE_OVERLAY_POLL_MS : 0,
        fallbackData: initialPerception
          ? { snapshot: initialPerception }
          : undefined,
      },
    );

  // 404 = the processor hasn't posted a snapshot yet — an empty state, not an
  // error. The live video must keep playing regardless.
  const missing =
    error instanceof UpstreamApiError &&
    (error.status === 404 || error.code === "perception_snapshot_not_found");
  const record: LatestPerceptionRecord | null = missing
    ? null
    : (data?.snapshot ?? initialPerception ?? null);
  const errored = !missing && error != null;

  const snapshot = record ? normalizeSnapshot(record.snapshot) : null;
  const dimsOk = snapshot != null && hasFrameDimensions(snapshot);

  const overlayObjects =
    snapshot && dimsOk
      ? selectOverlayObjects(
          snapshot.objects,
          snapshot.frameWidth,
          snapshot.frameHeight,
          minConfidence,
        )
      : [];

  const svg =
    snapshot && dimsOk ? (
      <PerceptionOverlaySvg
        snapshot={snapshot}
        showBoxes={showBoxes}
        showLabels={showLabels}
        showGeometry={showGeometry}
        minConfidence={minConfidence}
      />
    ) : null;

  const geometryCount = snapshot
    ? snapshot.rois.length + snapshot.lines.length
    : 0;

  return (
    <>
      <LiveStreamPlayer
        sessionId={sessionId}
        cameraId={cameraId}
        approved={approved}
        overlay={svg}
      />

      <div className="glass rounded-2xl p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="mono text-[11px] uppercase tracking-[0.18em] text-accent">
              live perception overlay
            </p>
            <p className="mt-1 text-sm text-ink-soft">
              {record && snapshot ? (
                <>
                  snapshot{" "}
                  <RelativeTime
                    value={record.observed_at}
                    className="text-ink"
                  />
                  {" · "}
                  {snapshot.objects.length} object
                  {snapshot.objects.length === 1 ? "" : "s"} · {geometryCount}{" "}
                  geometry
                </>
              ) : (
                "Latest perception snapshot, drawn over the live video"
              )}
              {isValidating ? " · refreshing…" : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleChip
              label="Boxes"
              icon={Boxes}
              active={showBoxes}
              onClick={() => setShowBoxes((v) => !v)}
            />
            <ToggleChip
              label="Labels"
              icon={Tag}
              active={showLabels}
              onClick={() => setShowLabels((v) => !v)}
            />
            <ToggleChip
              label="Geometry"
              icon={Spline}
              active={showGeometry}
              onClick={() => setShowGeometry((v) => !v)}
            />
            <select
              aria-label="Minimum object confidence"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
              className="rounded-lg border border-glass-stroke bg-glass-bg px-2.5 py-1.5 text-sm text-ink transition focus:border-accent/60 focus:outline-none"
            >
              {CONFIDENCE_THRESHOLDS.map((t) => (
                <option key={t} value={t}>
                  {t === 0 ? "All confidence" : `≥ ${Math.round(t * 100)}%`}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => setLive((p) => !p)}
              aria-pressed={live}
              className={clsx(
                "rounded-lg border px-2.5 py-1.5 text-sm transition",
                live
                  ? "border-accent/60 bg-accent/10 text-accent"
                  : "border-glass-stroke text-ink-soft hover:text-ink",
              )}
            >
              {live ? "Live: on" : "Live: off"}
            </button>
            <button
              type="button"
              onClick={() => void mutate()}
              disabled={isValidating}
              className="inline-flex items-center gap-1.5 rounded-lg border border-glass-stroke bg-glass-bg px-2.5 py-1.5 text-sm text-ink transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw
                className={clsx("h-3.5 w-3.5", isValidating && "animate-spin")}
              />
              Refresh
            </button>
          </div>
        </div>

        <OverlayMessage
          missing={missing}
          errored={errored}
          hasRecord={record != null}
          dimsOk={dimsOk}
          objectCount={snapshot?.objects.length ?? 0}
          drawnCount={overlayObjects.length}
        />
      </div>
    </>
  );
}

/**
 * Single contextual line under the controls. The live video keeps playing in
 * every branch — these only describe the overlay layer.
 */
function OverlayMessage({
  missing,
  errored,
  hasRecord,
  dimsOk,
  objectCount,
  drawnCount,
}: {
  missing: boolean;
  errored: boolean;
  hasRecord: boolean;
  dimsOk: boolean;
  objectCount: number;
  drawnCount: number;
}) {
  if (errored && !hasRecord) {
    return (
      <p className="mt-2 text-sm text-[#e89e93]">
        Couldn&rsquo;t load the perception snapshot — the live video is
        unaffected. Use Refresh to retry.
      </p>
    );
  }
  if (errored && hasRecord) {
    return (
      <p className="mt-2 text-xs text-[#e89e93]">
        Couldn&rsquo;t refresh — showing the last snapshot.
      </p>
    );
  }
  if (missing || !hasRecord) {
    return <p className="mt-2 text-sm text-ink-soft">No perception snapshot yet.</p>;
  }
  if (!dimsOk) {
    return (
      <p className="mt-2 text-sm text-[#e8c06b]">
        Snapshot frame dimensions are missing — the overlay is disabled for this
        snapshot.
      </p>
    );
  }
  if (objectCount === 0) {
    return (
      <p className="mt-2 text-sm text-ink-soft">
        No objects in latest snapshot. Showing geometry only.
      </p>
    );
  }
  if (drawnCount === 0) {
    return (
      <p className="mt-2 text-sm text-ink-soft">
        No objects to draw — all were filtered out or have no bounding box.
      </p>
    );
  }
  return null;
}

function ToggleChip({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof Boxes;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm transition",
        active
          ? "border-accent/60 bg-accent/10 text-accent"
          : "border-glass-stroke text-ink-mute hover:text-ink",
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
