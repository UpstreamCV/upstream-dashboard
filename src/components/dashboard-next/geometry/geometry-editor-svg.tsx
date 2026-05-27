"use client";

import type { GeometryLine, GeometryRoi } from "@/lib/api/types";
import type { NormalizedPoint } from "@/components/dashboard-next/geometry/geometry-editor-model";
import { OVERLAY_COLORS } from "@/lib/perception/overlay-helpers";

// P6-B1 — pure SVG overlay for the geometry editor. Renders existing
// lines (with endpoint handles), read-only ROI polygons (dimmer styling
// since they're not editable in this milestone), and a dashed draft line
// while drawing.
//
// COORDINATE SYSTEM: no viewBox. Positions are percentages so they map to
// the SVG's actual render box at any aspect ratio; sizes (stroke widths,
// handle radii) are in device pixels so they read consistently regardless
// of canvas size and never stretch into ovals when the frame's aspect
// ratio differs from the canvas slot. An earlier attempt used
// viewBox="0 0 1 1" + vectorEffect="non-scaling-stroke", which made
// strokes interpret their width in device pixels but kept circle radii in
// user units — the result was invisible-thin lines plus stretched oval
// handles. Percentages + pixel sizes sidestep both.

interface GeometryEditorSvgProps {
  lines: GeometryLine[];
  rois: GeometryRoi[];
  selectedLineId: string | null;
  draft: { start: NormalizedPoint; current: NormalizedPoint } | null;
  onLineSelect: (id: string) => void;
  onEndpointPointerDown: (
    lineId: string,
    endpoint: "a" | "b",
    e: React.PointerEvent,
  ) => void;
}

// Device-pixel sizes — read directly, no scaling.
const LINE_WIDTH = 3;
const LINE_WIDTH_SELECTED = 4;
const HIT_TARGET_WIDTH = 18;          // transparent, just for easier click-on-line
const ROI_STROKE = 2;
const HANDLE_RADIUS = 9;
const HANDLE_RADIUS_SELECTED = 11;
const HANDLE_STROKE = 2.5;
const HANDLE_STROKE_SELECTED = 3.5;
const HANDLE_INNER_RADIUS = 3;

// Color palette. Lines = amber (OVERLAY_COLORS.line) so the editor matches
// the perception overlay's visual language. Selected = a brighter amber so
// it pops without introducing a third hue. ROIs = sage-green from the
// shared OVERLAY_COLORS so the editor reads consistently with the live
// perception overlay elsewhere.
const LINE_COLOR = OVERLAY_COLORS.line;            // "#e8c06b"
const LINE_COLOR_SELECTED = "#fde68a";             // brighter amber
const HANDLE_FILL = "#ffffff";
const HANDLE_INNER_FILL_SELECTED = LINE_COLOR_SELECTED;

function pct(n: number): string {
  return `${n * 100}%`;
}

export function GeometryEditorSvg({
  lines,
  rois,
  selectedLineId,
  draft,
  onLineSelect,
  onEndpointPointerDown,
}: GeometryEditorSvgProps) {
  return (
    <svg
      className="absolute inset-0 h-full w-full"
      // Background pointer events go to FrameCanvas (draft start / deselect).
      // Individual hit targets opt back in via inline pointerEvents below.
      style={{ pointerEvents: "none" }}
      aria-label="Geometry overlay"
    >
      {/* Soft drop shadow definition — applied to selected handles so they
          lift off the frame underneath. Cheap visual depth, no extra DOM. */}
      <defs>
        <filter id="handle-shadow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.2" />
          <feOffset dx="0" dy="1" result="offsetblur" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.35" />
          </feComponentTransfer>
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* ROI polygons — read-only in P6-B1. Dim styling signals "this is
          data you can't edit yet." */}
      {rois.map((roi) => (
        <polygon
          key={`roi-${roi.id}`}
          points={roi.points.map((p) => `${pct(p.x)},${pct(p.y)}`).join(" ")}
          fill={OVERLAY_COLORS.roiFill}
          stroke={OVERLAY_COLORS.roiStroke}
          strokeWidth={ROI_STROKE}
          strokeOpacity={0.55}
          fillOpacity={0.45}
          strokeLinejoin="round"
        />
      ))}

      {/* Lines — visible stroke + invisible wide hit-target so clicks near
          the stroke still register. Endpoint handles render as a separate
          group below the line so they always sit on top. */}
      {lines.map((line) => {
        const [a, b] = line.points;
        if (!a || !b) return null;
        const selected = line.id === selectedLineId;
        const color = selected ? LINE_COLOR_SELECTED : LINE_COLOR;
        return (
          <g key={`line-${line.id}`}>
            {/* Wide invisible hit target. */}
            <line
              x1={pct(a.x)}
              y1={pct(a.y)}
              x2={pct(b.x)}
              y2={pct(b.y)}
              stroke="transparent"
              strokeWidth={HIT_TARGET_WIDTH}
              strokeLinecap="round"
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onLineSelect(line.id);
              }}
            />
            {/* The visible line. */}
            <line
              x1={pct(a.x)}
              y1={pct(a.y)}
              x2={pct(b.x)}
              y2={pct(b.y)}
              stroke={color}
              strokeWidth={selected ? LINE_WIDTH_SELECTED : LINE_WIDTH}
              strokeLinecap="round"
              style={{ pointerEvents: "none" }}
            />
            {/* Endpoint handles — white fill, colored ring. When selected
                we render a brighter ring, slight drop shadow, and an inner
                colored dot so the handle reads as "active". */}
            {(["a", "b"] as const).map((endpoint, idx) => {
              const p = idx === 0 ? a : b;
              const r = selected ? HANDLE_RADIUS_SELECTED : HANDLE_RADIUS;
              const sw = selected ? HANDLE_STROKE_SELECTED : HANDLE_STROKE;
              return (
                <g key={endpoint}>
                  <circle
                    cx={pct(p.x)}
                    cy={pct(p.y)}
                    r={r}
                    fill={HANDLE_FILL}
                    stroke={color}
                    strokeWidth={sw}
                    filter={selected ? "url(#handle-shadow)" : undefined}
                    style={{
                      pointerEvents: "auto",
                      cursor: "grab",
                    }}
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      onEndpointPointerDown(line.id, endpoint, e);
                    }}
                  />
                  {selected ? (
                    <circle
                      cx={pct(p.x)}
                      cy={pct(p.y)}
                      r={HANDLE_INNER_RADIUS}
                      fill={HANDLE_INNER_FILL_SELECTED}
                      style={{ pointerEvents: "none" }}
                    />
                  ) : null}
                </g>
              );
            })}
          </g>
        );
      })}

      {/* Draft preview while drawing. Dashed so it reads as "not committed
          yet." Pointer-events: none so it never blocks the next click. A
          small filled marker at the anchor point makes the start position
          obvious. */}
      {draft ? (
        <g style={{ pointerEvents: "none" }}>
          <line
            x1={pct(draft.start.x)}
            y1={pct(draft.start.y)}
            x2={pct(draft.current.x)}
            y2={pct(draft.current.y)}
            stroke={LINE_COLOR}
            strokeWidth={LINE_WIDTH}
            strokeDasharray="8 6"
            strokeLinecap="round"
          />
          <circle
            cx={pct(draft.start.x)}
            cy={pct(draft.start.y)}
            r={HANDLE_RADIUS - 1}
            fill={HANDLE_FILL}
            stroke={LINE_COLOR}
            strokeWidth={HANDLE_STROKE}
          />
        </g>
      ) : null}
    </svg>
  );
}
