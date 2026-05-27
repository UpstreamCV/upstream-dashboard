"use client";

import { useState } from "react";
import { Boxes, RefreshCw, Spline, Tag } from "lucide-react";
import clsx from "clsx";
import { RelativeTime } from "@/components/data/relative-time";
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
} from "@/lib/perception/overlay-helpers";
import { PerceptionOverlaySvg } from "@/lib/perception/overlay-svg";
import { LiveStreamPlayerNext } from "./live-stream-player-next";

// Polled snapshot cadence while the overlay is live. Matched to the processor's
// ~1 FPS perception publish rate — polling faster wouldn't surface newer data.
// The overlay still lags the live video by up to this interval plus network
// latency: it shows the latest snapshot, NOT frame-synchronized metadata.
const LIVE_OVERLAY_POLL_MS = 1_000;

const SELECT_CLASS =
  "rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition focus:border-[var(--dn-creek-mid)] focus:outline-none";

const CHIP_ACTIVE =
  "border-[var(--dn-creek-mid)]/40 bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]";
const CHIP_INACTIVE =
  "border-black/10 bg-white text-[var(--dn-text-50)] hover:text-black hover:bg-black/[0.04]";

/**
 * Dashboard-next port of the live perception overlay (P5-E). Draws the latest
 * P5-C perception snapshot over the live WebRTC video by reusing the shared
 * <PerceptionOverlaySvg /> renderer and helpers. Wraps <LiveStreamPlayerNext />
 * and feeds the SVG into the player's `overlay` slot — exactly one WebRTC
 * connection per session.
 *
 * The overlay polls the snapshot endpoint; it does not stream frame-synced
 * metadata. The latest-frame overlay (LatestFramePerceptionOverlayNext) is a
 * sibling — same data source, different presentation.
 */
export function LivePerceptionOverlayNext({
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
      <LiveStreamPlayerNext
        sessionId={sessionId}
        cameraId={cameraId}
        approved={approved}
        overlay={svg}
      />

      <div className="dn-tile p-[clamp(1rem,1.6vw,1.3rem)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
              live perception overlay
            </p>
            <p className="mt-1 text-sm text-[var(--dn-text-50)]">
              {record && snapshot ? (
                <>
                  snapshot{" "}
                  <RelativeTime
                    value={record.observed_at}
                    className="text-black"
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
              className={SELECT_CLASS}
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
                "rounded-full border px-2.5 py-1.5 text-sm transition",
                live ? CHIP_ACTIVE : CHIP_INACTIVE,
              )}
            >
              {live ? "Live: on" : "Live: off"}
            </button>
            <button
              type="button"
              onClick={() => void mutate()}
              disabled={isValidating}
              className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
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
      <p className="mt-2 text-sm text-[#c0473b]">
        Couldn&rsquo;t load the perception snapshot — the live video is
        unaffected. Use Refresh to retry.
      </p>
    );
  }
  if (errored && hasRecord) {
    return (
      <p className="mt-2 text-xs text-[#c0473b]">
        Couldn&rsquo;t refresh — showing the last snapshot.
      </p>
    );
  }
  if (missing || !hasRecord) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        No perception snapshot yet.
      </p>
    );
  }
  if (!dimsOk) {
    return (
      <p className="mt-2 text-sm text-[#8a6d1f]">
        Snapshot frame dimensions are missing — the overlay is disabled for this
        snapshot.
      </p>
    );
  }
  if (objectCount === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        No objects in latest snapshot. Showing geometry only.
      </p>
    );
  }
  if (drawnCount === 0) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm transition",
        active ? CHIP_ACTIVE : CHIP_INACTIVE,
      )}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}
