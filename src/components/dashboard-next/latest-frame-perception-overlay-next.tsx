"use client";

import { useState } from "react";
import { Boxes, ImageOff, RefreshCw, Spline, Tag } from "lucide-react";
import clsx from "clsx";
import { RelativeTime } from "@/components/data/relative-time";
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
} from "@/lib/perception/overlay-helpers";
import { PerceptionOverlaySvg } from "@/lib/perception/overlay-svg";

/**
 * Dashboard-next port of the latest-frame perception overlay (P5-D).
 *
 * Draws the latest perception snapshot over the latest captured frame: object
 * boxes + labels, ROI polygons and the entry line. Reuses the shared pure
 * helpers and the shared theme-agnostic <PerceptionOverlaySvg /> from
 * @/lib/perception/* — the only thing this file owns is the data-fetching
 * client island and the light-theme chrome around the canvas.
 *
 * No `accountId` prop — the proxy injects account scoping, same as the
 * latest-frame card next to it.
 */
export function LatestFramePerceptionOverlayNext({
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
    <div className="dn-tile p-[clamp(1.1rem,1.8vw,1.5rem)]">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[11px] uppercase tracking-wider font-mono text-[var(--dn-text-50)]">
            perception overlay
          </p>
          <p className="mt-1 text-sm text-[var(--dn-text-50)]">
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
            className={clsx("rounded-full border px-2.5 py-1.5 text-sm transition", live ? CHIP_ACTIVE : CHIP_INACTIVE)}
          >
            {live ? "Live: on" : "Live: off"}
          </button>
          <button
            type="button"
            onClick={refresh}
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

      {(frameErrored && frame) || (perceptionErrored && perceptionRecord) ? (
        <p className="mb-2 text-xs text-[#c0473b]">
          Couldn&rsquo;t refresh — showing the last result.
        </p>
      ) : null}

      {!frame ? (
        frameErrored ? (
          <InlineEmpty
            icon={<ImageOff className="h-6 w-6 mx-auto text-[var(--dn-text-50)]" aria-hidden />}
            title="Couldn't load the latest frame"
            description="The latest-frame request failed. Try again in a moment."
            action={<RetryButton onClick={refresh} disabled={isValidating} />}
          />
        ) : (
          <InlineEmpty
            icon={<ImageOff className="h-6 w-6 mx-auto text-[var(--dn-text-50)]" aria-hidden />}
            title="No latest frame available"
            description="When the agent starts streaming and uploads its first snapshot, it appears here with the perception overlay."
          />
        )
      ) : snapshot && dimsOk ? (
        <>
          <div
            className="relative w-full overflow-hidden rounded-xl bg-black"
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
            <p className="mt-2 text-sm text-[var(--dn-text-50)]">
              No objects in latest snapshot. Showing geometry only.
            </p>
          ) : overlayObjects.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--dn-text-50)]">
              No objects to draw — all were filtered out or have no bounding
              box.
            </p>
          ) : null}
        </>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl bg-black">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={frame.signed_url}
              alt="Latest captured frame"
              className="block h-auto w-full"
            />
          </div>
          {snapshot && !dimsOk ? (
            <p className="mt-2 text-sm text-[#8a6d1f]">
              Snapshot frame dimensions are missing — the overlay can&rsquo;t be
              aligned to the frame.
            </p>
          ) : perceptionErrored ? (
            <p className="mt-2 text-sm text-[var(--dn-text-50)]">
              Couldn&rsquo;t load the perception snapshot.
            </p>
          ) : (
            <p className="mt-2 text-sm text-[var(--dn-text-50)]">
              No perception snapshot yet.
            </p>
          )}
        </>
      )}

      {frame ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 font-mono text-[11px] text-[var(--dn-text-50)]">
          <span>
            frame{" "}
            {frame.width && frame.height
              ? `${frame.width}×${frame.height} · `
              : ""}
            <RelativeTime value={frame.captured_at} className="text-black/70" />
          </span>
          {perceptionRecord && snapshot ? (
            <span>
              snapshot{" "}
              {snapshot.frameWidth && snapshot.frameHeight
                ? `${snapshot.frameWidth}×${snapshot.frameHeight} · `
                : ""}
              <RelativeTime
                value={perceptionRecord.observed_at}
                className="text-black/70"
              />
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

// --- styling constants -------------------------------------------------------

const SELECT_CLASS =
  "rounded-full border border-black/10 bg-white px-2.5 py-1.5 text-sm text-black transition focus:border-[var(--dn-creek-mid)] focus:outline-none";

const CHIP_ACTIVE =
  "border-[var(--dn-creek-mid)]/40 bg-[var(--dn-creek-mid)]/15 text-[var(--dn-creek-deep)]";
const CHIP_INACTIVE =
  "border-black/10 bg-white text-[var(--dn-text-50)] hover:text-black hover:bg-black/[0.04]";

// --- small inline components -------------------------------------------------

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
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-sm transition",
        active ? CHIP_ACTIVE : CHIP_INACTIVE,
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
      className="inline-flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 py-1.5 text-sm text-black transition hover:bg-black/[0.04] disabled:cursor-not-allowed disabled:opacity-50"
    >
      <RefreshCw className={clsx("h-3.5 w-3.5", disabled && "animate-spin")} />
      Retry
    </button>
  );
}

function InlineEmpty({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-black/5 bg-black/[0.02] px-6 py-10 text-center">
      {icon}
      <h3 className="mt-3 font-bold text-black">{title}</h3>
      <p className="mt-2 max-w-prose mx-auto text-sm text-[var(--dn-text-50)]">
        {description}
      </p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
