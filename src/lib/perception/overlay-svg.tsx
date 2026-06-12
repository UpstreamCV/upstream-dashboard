// Pure presentational SVG layer for the perception overlay. No hooks, no
// data fetching — given a normalized snapshot and a set of display toggles it
// renders one `<svg>`. Kept separate from the data/state client component so it
// can be unit-tested directly with `renderToStaticMarkup` (no SWR, no jsdom).
//
// Coordinates are drawn in raw snapshot pixels: the `viewBox` is the frame
// itself, so the browser scales every shape to the displayed image for us.
// Strokes use `non-scaling-stroke` to keep a constant on-screen weight; text
// scales with the frame.
//
// Theme-agnostic: colors come from OVERLAY_COLORS constants and read on any
// background. Shared between /dashboard (dark) and /dashboard-next (light).

import type { NormalizedSnapshot } from "./overlay-helpers";
import {
  OVERLAY_COLORS,
  centroid,
  formatObjectLabel,
  pointsToAttr,
  selectOverlayObjects,
} from "./overlay-helpers";
import type { DisplayOverlayObject } from "./overlay-smoothing";

const MONO_FONT = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

export interface PerceptionOverlaySvgProps {
  snapshot: NormalizedSnapshot;
  showBoxes: boolean;
  showLabels: boolean;
  showGeometry: boolean;
  minConfidence: number;
  /** Pre-computed (possibly display-smoothed) boxes. When provided, the
   * internal raw selection is skipped and these are drawn instead — with
   * per-object opacity (the disappearance grace fade). Geometry (ROIs/lines)
   * is NEVER smoothed and always renders from the snapshot as configured. */
  objects?: DisplayOverlayObject[];
}

export function PerceptionOverlaySvg({
  snapshot,
  showBoxes,
  showLabels,
  showGeometry,
  minConfidence,
  objects,
}: PerceptionOverlaySvgProps) {
  const { frameWidth: fw, frameHeight: fh } = snapshot;
  // The client component only mounts this when dimensions exist; guard anyway
  // so a direct/malformed render degrades to nothing instead of throwing.
  if (fw === null || fh === null) return null;

  const fontSize = Math.max(13, Math.min(40, fh * 0.032));
  const overlayObjects: DisplayOverlayObject[] = showBoxes
    ? (objects ??
      selectOverlayObjects(snapshot.objects, fw, fh, minConfidence).map(
        (raw, idx) => ({
          key: raw.object.track_id ?? `untracked-${idx}`,
          opacity: 1,
          ...raw,
        }),
      ))
    : [];

  return (
    <svg
      viewBox={`0 0 ${fw} ${fh}`}
      preserveAspectRatio="xMidYMid meet"
      className="absolute inset-0 h-full w-full"
      role="img"
      aria-label="Perception overlay"
    >
      {showGeometry
        ? snapshot.rois.map((roi) => {
            const c = centroid(roi.points);
            return (
              <g key={`roi-${roi.id}`}>
                <polygon
                  points={pointsToAttr(roi.points)}
                  fill={OVERLAY_COLORS.roiFill}
                  stroke={OVERLAY_COLORS.roiStroke}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {showLabels && roi.label && c ? (
                  <HaloText
                    x={c.x}
                    y={c.y}
                    text={roi.label}
                    color={OVERLAY_COLORS.roiLabel}
                    fontSize={fontSize}
                    anchor="middle"
                  />
                ) : null}
              </g>
            );
          })
        : null}

      {showGeometry
        ? snapshot.lines.map((line) => {
            const start = line.points[0];
            return (
              <g key={`line-${line.id}`}>
                <polyline
                  points={pointsToAttr(line.points)}
                  fill="none"
                  stroke={OVERLAY_COLORS.line}
                  strokeWidth={3}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  vectorEffect="non-scaling-stroke"
                />
                {showLabels && line.label && start ? (
                  <HaloText
                    x={start.x}
                    y={start.y - fontSize * 0.5}
                    text={line.label}
                    color={OVERLAY_COLORS.lineLabel}
                    fontSize={fontSize}
                    anchor="start"
                  />
                ) : null}
              </g>
            );
          })
        : null}

      {overlayObjects.map(({ object, box, key, opacity }) => (
        <g key={`obj-${key}`} opacity={opacity === 1 ? undefined : opacity}>
          <rect
            x={box.x}
            y={box.y}
            width={box.w}
            height={box.h}
            fill="none"
            stroke={OVERLAY_COLORS.box}
            strokeWidth={2}
            vectorEffect="non-scaling-stroke"
          />
          {showLabels ? (
            <BoxLabel
              x={box.x}
              y={box.y}
              text={formatObjectLabel(object, { showRoi: true })}
              fontSize={fontSize}
            />
          ) : null}
        </g>
      ))}
    </svg>
  );
}

/** Object label: a filled chip above the box (or tucked inside if no room). */
function BoxLabel({
  x,
  y,
  text,
  fontSize,
}: {
  x: number;
  y: number;
  text: string;
  fontSize: number;
}) {
  const padX = fontSize * 0.45;
  const chipH = fontSize * 1.5;
  // Width is estimated from character count — SVG can't measure text on the
  // server. A monospace face keeps the estimate close enough.
  const width = text.length * fontSize * 0.6 + padX * 2;
  const top = y - chipH >= 0 ? y - chipH : y;
  return (
    <g>
      <rect
        x={x}
        y={top}
        width={width}
        height={chipH}
        rx={fontSize * 0.22}
        fill={OVERLAY_COLORS.boxLabelBg}
      />
      <text
        x={x + padX}
        y={top + chipH / 2}
        fill={OVERLAY_COLORS.boxLabelText}
        fontSize={fontSize}
        fontFamily={MONO_FONT}
        dominantBaseline="central"
      >
        {text}
      </text>
    </g>
  );
}

/** Geometry label: text with a dark stroke halo so it reads on any background. */
function HaloText({
  x,
  y,
  text,
  color,
  fontSize,
  anchor,
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
  anchor: "start" | "middle";
}) {
  return (
    <text
      x={x}
      y={y}
      fill={color}
      fontSize={fontSize}
      fontFamily={MONO_FONT}
      textAnchor={anchor}
      dominantBaseline="middle"
      stroke={OVERLAY_COLORS.labelHalo}
      strokeWidth={fontSize * 0.16}
      strokeLinejoin="round"
      paintOrder="stroke"
    >
      {text}
    </text>
  );
}
