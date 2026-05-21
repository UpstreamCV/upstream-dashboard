"use client";

import { useState } from "react";
import { Boxes, ImageOff, RefreshCw, Spline, Tag } from "lucide-react";
import clsx from "clsx";
import { RelativeTime } from "@/components/data/relative-time";
import { EmptyState } from "@/components/data/empty-state";
import { UpstreamApiError } from "@/lib/api/errors";
import { useUpstreamList } from "@/lib/api/use-list";
import type {
  LatestFrame,
  LatestPerceptionRecord,
  LatestPerceptionResponse,
} from "@/lib/api/types";
import {
  CONFIDENCE_THRESHOLDS,
  buildLatestPerceptionPath,
  hasFrameDimensions,
  normalizeSnapshot,
  selectOverlayObjects,
} from "./perception-overlay";
import { PerceptionOverlaySvg } from "./perception-overlay-svg";

/**
 * P5-D — latest-frame perception overlay. Draws the latest perception snapshot
 * (P5-C endpoint) over the latest captured frame: object boxes + labels, ROI
 * polygons and the entry line. This is a *still-frame* overlay — not a live
 * WebRTC overlay. It deliberately leaves the existing `<LatestFrameCard />`
 * untouched and stands beside it as its own card.
 *
 * Both the frame and the snapshot are server-rendered into `initial*` and then
 * refreshed on demand (or on an opt-in 5 s poll) through the dashboard proxy.
 * No `accountId` prop — the proxy injects account scoping, same as the rest of
 * the camera-detail panels.
 */
export function LatestFramePerceptionOverlay({
  cameraId,
  initialFrame,
  initialPerception,
}: {
  cameraId: string;
  initialFrame: LatestFrame | null;
  initialPerception: LatestPerceptionRecord | null;
}) {
  const [showBoxes, setShowBoxes] = useState(true);
  const [showLabels, setShowLabels] = useState(true);
  const [showGeometry, setShowGeometry] = useState(true);
  const [minConfidence, setMinConfidence] = useState(0);
  const [live, setLive] = useState(false);

  const refreshInterval = live ? 5_000 : 0;

  const frameSwr = useUpstreamList<LatestFrame>(
    `/v1/cameras/${cameraId}/latest-frame`,
    { refreshInterval, fallbackData: initialFrame ?? undefined },
  );
  const perceptionSwr = useUpstreamList<LatestPerceptionResponse>(
    buildLatestPerceptionPath(cameraId),
    {
      refreshInterval,
      fallbackData: initialPerception
        ? { snapshot: initialPerception }
        : undefined,
    },
  );

  // api-server returns 404 for a resource that hasn't been produced yet — that
  // is an empty state, not an error. Anything else is a real failure.
  const frameMissing = isMissing(frameSwr.error, "snapshot_not_found");
  const frame = frameMissing ? null : (frameSwr.data ?? initialFrame ?? null);
  const frameErrored = !frameMissing && frameSwr.error != null;

  const perceptionMissing = isMissing(
    perceptionSwr.error,
    "perception_snapshot_not_found",
  );
  const perceptionRecord = perceptionMissing
    ? null
    : (perceptionSwr.data?.snapshot ?? initialPerception ?? null);
  const perceptionErrored = !perceptionMissing && perceptionSwr.error != null;

  const snapshot = perceptionRecord
    ? normalizeSnapshot(perceptionRecord.snapshot)
    : null;
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

  const geometryCount = snapshot
    ? snapshot.rois.length + snapshot.lines.length
    : 0;
  const isValidating = frameSwr.isValidating || perceptionSwr.isValidating;

  function refresh() {
    void frameSwr.mutate();
    void perceptionSwr.mutate();
  }

  return (
    <div className="glass rounded-2xl p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="mono text-[11px] uppercase tracking-[0.18em] text-accent">
            perception overlay
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            {snapshot
              ? `${snapshot.objects.length} object${
                  snapshot.objects.length === 1 ? "" : "s"
                } · ${geometryCount} geometry`
              : "Latest frame with detected objects & geometry"}
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
            onClick={refresh}
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

      {(frameErrored && frame) || (perceptionErrored && perceptionRecord) ? (
        <p className="mb-2 text-xs text-[#e89e93]">
          Couldn&rsquo;t refresh — showing the last result.
        </p>
      ) : null}

      {!frame ? (
        frameErrored ? (
          <EmptyState
            icon={ImageOff}
            title="Couldn't load the latest frame"
            description="The latest-frame request failed. Try again in a moment."
            action={<RetryButton onClick={refresh} disabled={isValidating} />}
          />
        ) : (
          <EmptyState
            icon={ImageOff}
            title="No latest frame available"
            description="When the agent starts streaming and uploads its first snapshot, it appears here with the perception overlay."
          />
        )
      ) : snapshot && dimsOk ? (
        <>
          <div
            className="relative w-full overflow-hidden rounded-xl bg-[#0f1809]"
            style={{
              aspectRatio: `${snapshot.frameWidth} / ${snapshot.frameHeight}`,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.signed_url}
              alt="Latest captured frame"
              className="absolute inset-0 h-full w-full object-cover"
            />
            <PerceptionOverlaySvg
              snapshot={snapshot}
              showBoxes={showBoxes}
              showLabels={showLabels}
              showGeometry={showGeometry}
              minConfidence={minConfidence}
            />
          </div>
          {snapshot.objects.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No objects in latest snapshot. Showing geometry only.
            </p>
          ) : overlayObjects.length === 0 ? (
            <p className="mt-2 text-sm text-ink-soft">
              No objects to draw — all were filtered out or have no bounding
              box.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-[#0f1809]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.signed_url}
              alt="Latest captured frame"
              className="block h-auto w-full"
            />
          </div>
          {snapshot && !dimsOk ? (
            <p className="mt-2 text-sm text-[#e8c06b]">
              Snapshot frame dimensions are missing — the overlay can&rsquo;t be
              aligned to the frame.
            </p>
          ) : perceptionErrored ? (
            <p className="mt-2 text-sm text-ink-soft">
              Couldn&rsquo;t load the perception snapshot.
            </p>
          ) : (
            <p className="mt-2 text-sm text-ink-soft">
              No perception snapshot yet.
            </p>
          )}
        </>
      )}

      {frame ? (
        <div className="mono mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-[11px] text-ink-mute">
          <span>
            frame{" "}
            {frame.width && frame.height
              ? `${frame.width}×${frame.height} · `
              : ""}
            <RelativeTime value={frame.captured_at} className="text-ink-soft" />
          </span>
          {perceptionRecord && snapshot ? (
            <span>
              snapshot{" "}
              {snapshot.frameWidth && snapshot.frameHeight
                ? `${snapshot.frameWidth}×${snapshot.frameHeight} · `
                : ""}
              <RelativeTime
                value={perceptionRecord.observed_at}
                className="text-ink-soft"
              />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function isMissing(err: unknown, notFoundCode: string): boolean {
  return (
    err instanceof UpstreamApiError &&
    (err.status === 404 || err.code === notFoundCode)
  );
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

function RetryButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="inline-flex items-center gap-1.5 rounded-lg border border-glass-stroke bg-glass-bg px-3 py-1.5 text-sm text-ink transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={clsx("h-3.5 w-3.5", disabled && "animate-spin")} />
      Retry
    </button>
  );
}
