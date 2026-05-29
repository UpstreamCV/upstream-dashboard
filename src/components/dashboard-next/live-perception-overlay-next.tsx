"use client";

import { useEffect, useState } from "react";
import { Boxes, RefreshCw, Spline, Tag } from "lucide-react";
import clsx from "clsx";
import { UpstreamApiError } from "@/lib/api/errors";
import { useUpstreamList } from "@/lib/api/use-list";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import type {
  LatestPerceptionRecord,
  LatestPerceptionResponse,
  StreamParams,
} from "@/lib/api/types";
import {
  CONFIDENCE_THRESHOLDS,
  buildLatestPerceptionPath,
  formatOverlayAge,
  hasFrameDimensions,
  normalizeSnapshot,
  observedAtAgeSeconds,
  selectOverlayObjects,
} from "@/lib/perception/overlay-helpers";
import { PerceptionOverlaySvg } from "@/lib/perception/overlay-svg";
import { LiveStreamPlayerNext } from "./live-stream-player-next";

// Poll cadence while the overlay is live. This is the SELF-SUFFICIENT
// baseline — the overlay must feel near-real-time on polling alone, because
// realtime push depends on the latest_perception_snapshots table being in
// the supabase_realtime publication (a migration that may not be applied in
// every environment). If we leaned on realtime as the only fast path and it
// wasn't delivering, the overlay would silently fall back to a slow poll and
// look frozen. 500ms ≈ 2 fetches/sec, which tracks the processor's ~3 FPS
// publish rate closely; realtime push (when the migration is live) makes it
// snappier still by refetching the instant a snapshot lands.
const LIVE_OVERLAY_POLL_MS = 500;

// Default age after which the snapshot is considered stale. A live processor
// publishes every ~0.3-1s, so anything older than ~10s almost certainly means
// the processor is silent or the camera stopped -- the overlay is no longer
// telling the truth about the current scene.
const DEFAULT_STALE_AFTER_SECONDS = 10;

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
  // M5 polish: M3 master switch threaded down from the Monitor page. When
  // false, the overlay shows a dedicated "enable processing in Settings"
  // empty state instead of the generic "no snapshot yet" copy.
  processingEnabled = true,
  // Snapshots older than this look like the processor is silent or the
  // camera stopped streaming. The overlay surfaces a stale warning above
  // the empty-state line; boxes still render with reduced visual weight
  // is out of scope -- v1 just calls it out in copy.
  staleAfterSeconds = DEFAULT_STALE_AFTER_SECONDS,
  // Injectable so tests can pin a deterministic "now". Production uses
  // Date.now() implicitly via the default.
  now = Date.now,
}: {
  sessionId: string;
  cameraId: string;
  approved: StreamParams;
  initialPerception: LatestPerceptionRecord | null;
  processingEnabled?: boolean;
  staleAfterSeconds?: number;
  now?: () => number;
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

  // Realtime push: subscribe to row changes on latest_perception_snapshots
  // for this camera and refetch the moment the processor upserts a new
  // snapshot. Same sanctioned Supabase Realtime pattern as
  // CameraDetailRealtimeNext (which watches stream_sessions) — broadcasts
  // respect the table's member-select RLS, so this adds no new auth surface
  // and the api-server pushes nothing. We use the event purely as a trigger
  // to revalidate the existing SWR key (AGENTS.md: "only for change
  // notifications that trigger ... local state updates"), keeping one safe,
  // secret-filtered data path through /perception/latest.
  //
  // Push removes the poll-latency component of the lag. It does NOT change
  // the once-per-second motion of the boxes — that's the processor's ~1 FPS
  // publish cadence (perception_snapshot_interval_seconds). Bumping that env
  // is the follow-up for smoother motion.
  useEffect(() => {
    if (!live) return;
    const supabase = createSupabaseBrowserClient();
    const channel = supabase
      .channel(`dn-camera:${cameraId}:perception`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "latest_perception_snapshots",
          filter: `camera_id=eq.${cameraId}`,
        },
        () => {
          // New (or updated) snapshot row exists — pull the fresh one. The
          // bound mutate() forces a revalidation; SWR's polling already
          // bypasses dedupingInterval, and so does an explicit mutate, so
          // each upsert yields one refetch.
          void mutate();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [live, cameraId, mutate]);

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

  // Age + stale gate. Computed against the injected ``now`` so tests can pin a
  // deterministic clock. ``ageSeconds`` is null when there's no observation to
  // age (no snapshot yet) -- the empty-state branch handles that case.
  const ageSeconds = record
    ? observedAtAgeSeconds(record.observed_at, now())
    : null;
  const ageLabel = record ? formatOverlayAge(record.observed_at, now()) : null;
  const isStale = ageSeconds !== null && ageSeconds > staleAfterSeconds;

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
                  {ageLabel ? (
                    <span className="text-black">{ageLabel}</span>
                  ) : (
                    "live"
                  )}
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
          processingEnabled={processingEnabled}
          isStale={isStale}
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
  processingEnabled,
  isStale,
}: {
  missing: boolean;
  errored: boolean;
  hasRecord: boolean;
  dimsOk: boolean;
  objectCount: number;
  drawnCount: number;
  processingEnabled: boolean;
  isStale: boolean;
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
  // Processing-disabled gets priority over generic empty state -- the
  // operator chose this, so we tell them where to undo it. Sits above
  // missing/!hasRecord so they see "enable processing" instead of
  // "no perception snapshot yet" the first time they look after toggling.
  if (!processingEnabled && (missing || !hasRecord)) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        Processing is disabled. Enable processing in Settings to see detections.
      </p>
    );
  }
  if (missing || !hasRecord) {
    return (
      <p className="mt-2 text-sm text-[var(--dn-text-50)]">
        No perception data yet. Start processing to see detections.
      </p>
    );
  }
  // Stale check sits above dims/empty so the operator hears the bigger story
  // ("this isn't current") before the smaller one ("no objects in this
  // particular snapshot").
  if (isStale) {
    return (
      <p className="mt-2 text-sm text-[#8a6d1f]">
        Processor output is stale. Overlay may not reflect the current scene.
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
        No detections in latest perception snapshot.
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
